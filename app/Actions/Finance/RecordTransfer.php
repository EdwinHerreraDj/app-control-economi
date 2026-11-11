<?php

namespace App\Actions\Finance;

use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Transferencias entre cuentas propias.
 *
 * Cada transferencia mantiene dos movimientos enlazados (salida de una
 * cuenta, entrada en otra) que se crean, modifican y anulan siempre juntos
 * dentro de una transacción de base de datos. Afectan al saldo de ambas
 * cuentas pero no cuentan como ingreso ni como gasto.
 */
class RecordTransfer
{
    /**
     * @param  array{from: Account, to: Account, amount: int, occurred_on: string, status: TransactionStatus, concept?: string|null, notes?: string|null}  $data
     */
    public function create(User $user, array $data): Transfer
    {
        $this->guardAccounts($data['from'], $data['to']);

        return DB::transaction(function () use ($user, $data) {
            $transfer = new Transfer($this->transferAttributes($data));
            $transfer->user()->associate($user);
            $transfer->save();

            foreach ([TransactionKind::TransferOut, TransactionKind::TransferIn] as $kind) {
                $movement = new Transaction($this->movementAttributes($transfer, $kind));
                $movement->user()->associate($user);
                $movement->save();
            }

            return $transfer;
        });
    }

    /**
     * @param  array{from: Account, to: Account, amount: int, occurred_on: string, status: TransactionStatus, concept?: string|null, notes?: string|null}  $data
     */
    public function update(Transfer $transfer, array $data): void
    {
        $this->guardEditable($transfer);

        $changedAccounts = array_filter([
            $data['from']->isNot($transfer->fromAccount) ? $data['from'] : null,
            $data['to']->isNot($transfer->toAccount) ? $data['to'] : null,
        ]);
        $this->guardAccounts($data['from'], $data['to'], $changedAccounts);

        DB::transaction(function () use ($transfer, $data) {
            $transfer->update($this->transferAttributes($data));

            foreach ($transfer->transactions as $movement) {
                $movement->update($this->movementAttributes($transfer, $movement->kind));
            }
        });
    }

    public function confirm(Transfer $transfer): void
    {
        $this->guardEditable($transfer);

        DB::transaction(function () use ($transfer) {
            $transfer->update(['status' => TransactionStatus::Confirmed]);
            $transfer->transactions()->update(['status' => TransactionStatus::Confirmed->value]);
        });
    }

    public function void(Transfer $transfer, string $reason): void
    {
        $this->guardEditable($transfer);

        DB::transaction(function () use ($transfer, $reason) {
            $now = now();
            $transfer->update(['voided_at' => $now, 'void_reason' => $reason]);
            $transfer->transactions()->update(['voided_at' => $now, 'void_reason' => $reason]);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function transferAttributes(array $data): array
    {
        return [
            'from_account_id' => $data['from']->id,
            'to_account_id' => $data['to']->id,
            'amount' => $data['amount'],
            'currency' => $data['from']->currency,
            'occurred_on' => $data['occurred_on'],
            'status' => $data['status'],
            'concept' => $data['concept'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function movementAttributes(Transfer $transfer, TransactionKind $kind): array
    {
        $isOut = $kind === TransactionKind::TransferOut;

        return [
            'transfer_id' => $transfer->id,
            'kind' => $kind,
            'account_id' => $isOut ? $transfer->from_account_id : $transfer->to_account_id,
            'category_id' => null,
            'amount' => $transfer->amount,
            'currency' => $transfer->currency,
            'occurred_on' => $transfer->occurred_on->toDateString(),
            'status' => $transfer->status,
            'concept' => $transfer->concept ?: 'Transferencia entre cuentas',
            'notes' => $transfer->notes,
        ];
    }

    /**
     * @param  array<int, Account>|null  $mustBeActive  Cuentas que deben estar activas (por defecto, ambas).
     */
    private function guardAccounts(Account $from, Account $to, ?array $mustBeActive = null): void
    {
        if ($from->is($to)) {
            throw ValidationException::withMessages([
                'to_account_id' => 'Elige dos cuentas distintas.',
            ]);
        }

        if ($from->currency !== $to->currency) {
            throw ValidationException::withMessages([
                'to_account_id' => 'Las dos cuentas deben tener la misma moneda.',
            ]);
        }

        foreach ($mustBeActive ?? [$from, $to] as $account) {
            if ($account->isArchived()) {
                throw ValidationException::withMessages([
                    $account->is($from) ? 'from_account_id' : 'to_account_id' => "La cuenta «{$account->name}» está archivada.",
                ]);
            }
        }
    }

    private function guardEditable(Transfer $transfer): void
    {
        if ($transfer->isVoided()) {
            throw ValidationException::withMessages([
                'transfer' => 'La transferencia está anulada y ya no se puede modificar.',
            ]);
        }
    }
}
