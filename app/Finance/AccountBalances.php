<?php

namespace App\Finance;

use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Saldo real de las cuentas: saldo inicial más movimientos confirmados y no
 * anulados. Los movimientos previstos no lo modifican.
 *
 * Todo el cálculo se hace en la base de datos con enteros (unidad menor).
 */
class AccountBalances
{
    /**
     * @return array<int, int> Saldo real por id de cuenta, en unidades menores.
     */
    public function forUser(User $user): array
    {
        $movements = $this->movementTotals($user->getKey());

        return Account::query()
            ->ownedBy($user)
            ->pluck('initial_balance', 'id')
            ->map(fn ($initial, $id) => (int) $initial + ($movements[$id] ?? 0))
            ->all();
    }

    public function forAccount(Account $account): int
    {
        return $account->initial_balance + ($this->movementTotals($account->user_id, $account->id)[$account->id] ?? 0);
    }

    /**
     * @return array<int, int>
     */
    private function movementTotals(int $userId, ?int $accountId = null): array
    {
        $positive = [TransactionKind::Income->value, TransactionKind::TransferIn->value];

        return DB::table('transactions')
            ->where('user_id', $userId)
            ->when($accountId !== null, fn ($query) => $query->where('account_id', $accountId))
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            ->groupBy('account_id')
            ->selectRaw(
                'account_id, SUM(CASE WHEN kind IN (?, ?) THEN amount ELSE -amount END) AS total',
                $positive,
            )
            ->pluck('total', 'account_id')
            ->map(fn ($total) => (int) $total)
            ->all();
    }
}
