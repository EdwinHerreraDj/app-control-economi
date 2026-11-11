<?php

namespace App\Sync;

use App\Actions\Finance\RecordTransaction;
use App\Enums\ExpenseNature;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Http\Requests\Finance\TransactionRequest;
use App\Models\Account;
use App\Models\Category;
use App\Models\SyncOperation;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Aplica las operaciones registradas sin conexión.
 *
 * El servidor vuelve a validarlo todo como si llegara del formulario: la
 * propiedad de cuentas y categorías, los importes y el estado de la cuenta.
 * Nada se sobrescribe en silencio: lo que no puede aplicarse se devuelve
 * como rechazado o en conflicto para que la persona decida.
 */
class OperationProcessor
{
    public const MAX_BATCH = 50;

    public const TYPES = ['transaction.create'];

    public function __construct(private readonly RecordTransaction $record) {}

    /**
     * @param  array{uuid: string, type: string, payload: array<string, mixed>, created_at?: string|null, confirm_duplicate?: bool}  $operation
     * @return array{uuid: string, status: string, errors: array<string, list<string>>|null, duplicate: array<string, string>|null}
     */
    public function process(User $user, array $operation): array
    {
        $existing = SyncOperation::query()->ownedBy($user)->where('uuid', $operation['uuid'])->first();

        // Ya aplicada: se responde lo mismo sin volver a registrarla.
        if ($existing?->status === SyncOperation::APPLIED) {
            return $this->result($existing->uuid, SyncOperation::APPLIED);
        }

        $outcome = DB::transaction(fn () => $this->apply($user, $operation));

        $record = $existing ?? new SyncOperation(['uuid' => $operation['uuid']]);
        $record->user()->associate($user);
        $record->fill([
            'type' => $operation['type'],
            'status' => $outcome['status'],
            'transaction_id' => $outcome['transaction']?->id,
            'errors' => $outcome['errors'],
            'attempts' => $existing !== null ? $existing->attempts + 1 : 1,
            'client_created_at' => $this->clientDate($operation['created_at'] ?? null),
        ]);

        try {
            $record->save();
        } catch (UniqueConstraintViolationException) {
            // Dos envíos simultáneos de la misma operación: vale el primero.
            $first = SyncOperation::query()->ownedBy($user)->where('uuid', $operation['uuid'])->firstOrFail();

            return $this->result($first->uuid, $first->status, $first->errors);
        }

        return $this->result($record->uuid, $record->status, $record->errors, $outcome['duplicate']);
    }

    /**
     * @param  array{uuid: string, type: string, payload: array<string, mixed>, confirm_duplicate?: bool}  $operation
     * @return array{status: string, errors: array<string, list<string>>|null, transaction: Transaction|null, duplicate: array<string, string>|null}
     */
    private function apply(User $user, array $operation): array
    {
        if ($operation['type'] !== 'transaction.create') {
            return $this->rejected(['type' => ['Esta operación no se puede registrar sin conexión.']]);
        }

        $payload = $this->clean($operation['payload']);

        $validator = Validator::make(
            $payload,
            [
                'kind' => ['required', Rule::in([TransactionKind::Income->value, TransactionKind::Expense->value])],
                ...TransactionRequest::fieldRules($user),
            ],
            [],
            [...TransactionRequest::labels(), 'kind' => 'tipo'],
        );

        if ($validator->fails()) {
            /** @var array<string, list<string>> $messages */
            $messages = $validator->errors()->toArray();

            return $this->rejected($messages);
        }

        /** @var array{kind: string, account_id: int, category_id: int, amount: string, occurred_on: string, status: string, concept: string, notes?: string|null, nature?: string|null, due_on?: string|null} $data */
        $data = $validator->validated();
        $currency = (string) $user->currency;
        $amount = Money::toMinor((string) $data['amount'], $currency);
        $kind = TransactionKind::from($data['kind']);

        // Ya se registró por otra vía (otro dispositivo, o en línea): avisar.
        if (! ($operation['confirm_duplicate'] ?? false)) {
            $duplicate = Transaction::query()->ownedBy($user)
                ->whereNull('voided_at')
                ->where('uuid', '!=', $operation['uuid'])
                ->where('kind', $kind->value)
                ->where('account_id', $data['account_id'])
                ->where('amount', $amount)
                ->whereDate('occurred_on', $data['occurred_on'])
                ->where('concept', $data['concept'])
                ->first();

            if ($duplicate !== null) {
                return [
                    'status' => SyncOperation::CONFLICT,
                    'errors' => ['duplicate' => ['Ya existe un movimiento igual (misma cuenta, fecha, importe y concepto). ¿Es el mismo o quieres registrarlo también?']],
                    'transaction' => null,
                    'duplicate' => [
                        'concept' => $duplicate->concept,
                        'occurred_on' => $duplicate->occurred_on->toDateString(),
                        'amount' => Money::toDecimal($duplicate->amount, $duplicate->currency),
                    ],
                ];
            }
        }

        try {
            $transaction = $this->record->create($user, [
                'kind' => $kind,
                'account' => Account::query()->ownedBy($user)->findOrFail($data['account_id']),
                'category' => Category::query()->ownedBy($user)->findOrFail($data['category_id']),
                'amount' => $amount,
                'occurred_on' => $data['occurred_on'],
                'status' => TransactionStatus::from($data['status']),
                'concept' => $data['concept'],
                'notes' => $data['notes'] ?? null,
                'nature' => isset($data['nature']) ? ExpenseNature::from($data['nature']) : null,
                'due_on' => $data['due_on'] ?? null,
                // El identificador del dispositivo evita duplicar el movimiento.
                'uuid' => $operation['uuid'],
            ]);
        } catch (ValidationException $exception) {
            /** @var array<string, list<string>> $messages */
            $messages = $exception->errors();

            return $this->rejected($messages);
        } catch (UniqueConstraintViolationException) {
            return $this->rejected(['uuid' => ['El identificador de la operación no es válido. Vuelve a registrarla.']]);
        }

        return ['status' => SyncOperation::APPLIED, 'errors' => null, 'transaction' => $transaction, 'duplicate' => null];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function clean(array $payload): array
    {
        foreach (['concept', 'notes'] as $field) {
            if (is_string($payload[$field] ?? null)) {
                $payload[$field] = trim($payload[$field]);
            }
        }

        if (($payload['notes'] ?? null) === '') {
            $payload['notes'] = null;
        }

        return $payload;
    }

    /**
     * @param  array<string, list<string>>  $errors
     * @return array{status: string, errors: array<string, list<string>>, transaction: null, duplicate: null}
     */
    private function rejected(array $errors): array
    {
        return ['status' => SyncOperation::REJECTED, 'errors' => $errors, 'transaction' => null, 'duplicate' => null];
    }

    /**
     * @param  array<string, list<string>>|null  $errors
     * @param  array<string, string>|null  $duplicate
     * @return array{uuid: string, status: string, errors: array<string, list<string>>|null, duplicate: array<string, string>|null}
     */
    private function result(string $uuid, string $status, ?array $errors = null, ?array $duplicate = null): array
    {
        return ['uuid' => $uuid, 'status' => $status, 'errors' => $errors, 'duplicate' => $duplicate];
    }

    private function clientDate(?string $value): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
