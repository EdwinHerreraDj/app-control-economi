<?php

namespace App\Http\Requests\Finance;

use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Rules\MoneyAmount;
use App\Support\Money;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Alta y edición de ingresos y gastos.
 */
class TransactionRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isUpdate = $this->route('transaction') instanceof Transaction;

        return [
            'kind' => $isUpdate
                ? ['prohibited']
                : ['required', Rule::in([TransactionKind::Income->value, TransactionKind::Expense->value])],
            'uuid' => $isUpdate ? ['prohibited'] : ['nullable', 'uuid'],
            // «Se repite»: además del movimiento, crea su recurrencia.
            'repeat' => $isUpdate ? ['prohibited'] : ['nullable', Rule::enum(Frequency::class)],
            ...self::fieldRules($this->owner()),
        ];
    }

    /**
     * Reglas de los campos comunes; también las usa la sincronización de
     * movimientos registrados sin conexión.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public static function fieldRules(User $owner): array
    {
        return [
            'account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('user_id', $owner->getKey())],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('user_id', $owner->getKey())],
            'amount' => ['required', new MoneyAmount((string) $owner->currency)],
            'occurred_on' => ['required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::enum(TransactionStatus::class)],
            'concept' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'nature' => ['nullable', Rule::enum(ExpenseNature::class)],
            'due_on' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return self::labels();
    }

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        return [
            'account_id' => 'cuenta',
            'category_id' => 'categoría',
            'amount' => 'importe',
            'occurred_on' => 'fecha',
            'status' => 'estado',
            'concept' => 'concepto',
            'notes' => 'notas',
            'nature' => 'tipo de gasto',
            'due_on' => 'vencimiento',
            'repeat' => 'repetición',
        ];
    }

    /**
     * Datos validados en el formato que esperan las acciones.
     *
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $validated = $this->validated();

        return [
            ...(isset($validated['kind']) ? ['kind' => TransactionKind::from($validated['kind'])] : []),
            'uuid' => $validated['uuid'] ?? null,
            'repeat' => isset($validated['repeat']) ? Frequency::from($validated['repeat']) : null,
            'account' => Account::query()->ownedBy($this->owner())->findOrFail($validated['account_id']),
            'category' => Category::query()->ownedBy($this->owner())->findOrFail($validated['category_id']),
            'amount' => Money::toMinor((string) $validated['amount'], $this->currency()),
            'occurred_on' => $validated['occurred_on'],
            'status' => TransactionStatus::from($validated['status']),
            'concept' => $validated['concept'],
            'notes' => $validated['notes'] ?? null,
            'nature' => isset($validated['nature']) ? ExpenseNature::from($validated['nature']) : null,
            'due_on' => $validated['due_on'] ?? null,
        ];
    }
}
