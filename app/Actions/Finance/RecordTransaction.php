<?php

namespace App\Actions\Finance;

use App\Enums\ExpenseNature;
use App\Enums\SpendingType;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Alta, edición, confirmación y anulación de ingresos y gastos.
 *
 * Las transferencias tienen su propia acción (RecordTransfer): sus dos
 * movimientos siempre se modifican juntos.
 */
class RecordTransaction
{
    /**
     * @param  array{
     *     kind: TransactionKind,
     *     account: Account,
     *     category: Category,
     *     amount: int,
     *     occurred_on: string,
     *     status: TransactionStatus,
     *     concept: string,
     *     notes?: string|null,
     *     nature?: ExpenseNature|null,
     *     due_on?: string|null,
     *     spending_type?: SpendingType|null,
     *     uuid?: string|null,
     * }  $data
     */
    public function create(User $user, array $data): Transaction
    {
        $this->guardKind($data['kind']);
        $this->guardAccount($data['account']);
        $this->guardCategory($data['kind'], $data['category']);

        // Idempotencia: reenviar el mismo identificador no duplica el movimiento.
        if (! empty($data['uuid'])) {
            $existing = Transaction::query()->ownedBy($user)->where('uuid', $data['uuid'])->first();

            if ($existing !== null) {
                return $existing;
            }
        }

        $transaction = new Transaction($this->attributes($data));
        if (! empty($data['uuid'])) {
            $transaction->uuid = $data['uuid'];
        }
        $transaction->user()->associate($user);
        $transaction->save();

        return $transaction;
    }

    /**
     * @param  array{
     *     account: Account,
     *     category: Category,
     *     amount: int,
     *     occurred_on: string,
     *     status: TransactionStatus,
     *     concept: string,
     *     notes?: string|null,
     *     nature?: ExpenseNature|null,
     *     due_on?: string|null,
     * }  $data
     */
    public function update(Transaction $transaction, array $data): void
    {
        $this->guardEditable($transaction);

        if ($data['account']->isNot($transaction->account)) {
            $this->guardAccount($data['account']);
        }

        $this->guardCategory($transaction->kind, $data['category']);

        $transaction->update($this->attributes([...$data, 'kind' => $transaction->kind]));
    }

    /**
     * Marca como cobrado o pagado un movimiento previsto.
     */
    public function confirm(Transaction $transaction, ?CarbonImmutable $on = null): void
    {
        $this->guardEditable($transaction);

        if ($transaction->status === TransactionStatus::Confirmed) {
            return;
        }

        $transaction->update([
            'status' => TransactionStatus::Confirmed,
            'occurred_on' => ($on ?? $transaction->occurred_on)->toDateString(),
        ]);
    }

    /**
     * «Ya lo pagué» / «Ya lo cobré»: confirma un movimiento pendiente con lo
     * que ocurrió de verdad (el importe de la luz cambia cada mes, o se pagó
     * otro día o desde otra cuenta). Si viene de un pago habitual, sigue
     * enlazado a su fecha prevista: no se vuelve a generar.
     */
    public function confirmWith(Transaction $transaction, ?int $amount = null, ?CarbonImmutable $on = null, ?Account $account = null): void
    {
        $this->guardEditable($transaction);

        if ($transaction->status === TransactionStatus::Confirmed) {
            return;
        }

        if ($account !== null && $account->isNot($transaction->account)) {
            $this->guardAccount($account);
        }

        $transaction->update([
            'status' => TransactionStatus::Confirmed,
            'occurred_on' => ($on ?? $transaction->occurred_on)->toDateString(),
            'amount' => $amount ?? $transaction->amount,
            'account_id' => ($account ?? $transaction->account)->id,
            'currency' => ($account ?? $transaction->account)->currency,
        ]);
    }

    /**
     * Borra un ingreso o gasto. Si era una fecha de un pago habitual, se
     * marca como omitida en lugar de borrarla, para que no vuelva a aparecer.
     */
    public function delete(Transaction $transaction): void
    {
        $this->guardEditable($transaction);

        if ($transaction->recurring_rule_id !== null && $transaction->status === TransactionStatus::Planned) {
            $transaction->update(['voided_at' => now(), 'void_reason' => 'Omitido']);

            return;
        }

        $transaction->delete();
    }

    /**
     * Anula el movimiento conservándolo en el historial: deja de contar
     * para saldos y estadísticas, pero queda constancia de qué pasó.
     */
    public function void(Transaction $transaction, string $reason): void
    {
        $this->guardEditable($transaction);

        $transaction->update([
            'voided_at' => now(),
            'void_reason' => $reason,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data): array
    {
        $isExpense = $data['kind'] === TransactionKind::Expense;

        return [
            'kind' => $data['kind'],
            'account_id' => $data['account']->id,
            'category_id' => $data['category']->id,
            'amount' => $data['amount'],
            'currency' => $data['account']->currency,
            'occurred_on' => $data['occurred_on'],
            'status' => $data['status'],
            'concept' => $data['concept'],
            'notes' => $data['notes'] ?? null,
            // Fijo/variable y vencimiento solo tienen sentido en los gastos.
            'nature' => $isExpense ? ($data['nature'] ?? null) : null,
            'due_on' => $isExpense ? ($data['due_on'] ?? null) : null,
            'spending_type' => $isExpense ? ($data['spending_type'] ?? null) : null,
        ];
    }

    private function guardKind(TransactionKind $kind): void
    {
        if ($kind->isTransfer()) {
            throw ValidationException::withMessages([
                'kind' => 'Las transferencias se registran desde la opción Transferencia.',
            ]);
        }
    }

    private function guardAccount(Account $account): void
    {
        if ($account->isArchived()) {
            throw ValidationException::withMessages([
                'account_id' => 'La cuenta está archivada. Restáurala para registrar movimientos en ella.',
            ]);
        }
    }

    private function guardCategory(TransactionKind $kind, Category $category): void
    {
        if ($category->kind !== $kind->categoryKind()) {
            throw ValidationException::withMessages([
                'category_id' => $kind === TransactionKind::Income
                    ? 'Elige una categoría de ingresos.'
                    : 'Elige una categoría de gastos.',
            ]);
        }
    }

    private function guardEditable(Transaction $transaction): void
    {
        if ($transaction->kind->isTransfer()) {
            throw ValidationException::withMessages([
                'transaction' => 'Este movimiento forma parte de una transferencia. Modifícala desde la transferencia.',
            ]);
        }

        if ($transaction->kind->isDebtPrincipal() || $transaction->debt_payment_id !== null) {
            throw ValidationException::withMessages([
                'transaction' => 'Este movimiento pertenece a una deuda. Gestiónalo desde el apartado Deudas.',
            ]);
        }

        if ($transaction->isVoided()) {
            throw ValidationException::withMessages([
                'transaction' => 'El movimiento está anulado y ya no se puede modificar.',
            ]);
        }
    }
}
