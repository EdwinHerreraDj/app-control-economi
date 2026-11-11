<?php

namespace App\Finance;

use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Debt;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;

/**
 * Próximos cobros, pagos y cuotas de deuda, incluidos los previstos que
 * ya deberían haber ocurrido y siguen sin confirmar.
 *
 * Las cuotas de deuda son orientativas (las indica el usuario): no se
 * cuentan dos veces si además existe un gasto previsto para lo mismo,
 * porque son registros distintos que la persona decide mantener.
 */
class UpcomingCommitments
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function forUser(User $user, ?int $days = null): array
    {
        $today = $user->today();
        $until = $today->addDays($days ?? (int) config('finance.upcoming_days', 45));

        $planned = Transaction::query()
            ->ownedBy($user)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->whereIn('kind', [TransactionKind::Income->value, TransactionKind::Expense->value])
            ->where('occurred_on', '<=', $until->toDateString())
            ->with(['account:id,name', 'category:id,name,icon,color'])
            ->orderBy('occurred_on')
            ->limit(200)
            ->get()
            ->map(fn (Transaction $transaction) => [
                'type' => 'movement',
                'id' => $transaction->id,
                'kind' => $transaction->kind->value,
                'date' => $transaction->occurred_on->toDateString(),
                'overdue' => $transaction->occurred_on->lessThan($today),
                'concept' => $transaction->concept,
                'amount' => Money::toDecimal($transaction->amount, $transaction->currency),
                'account' => $transaction->account->name,
                'category' => $transaction->category ? [
                    'name' => $transaction->category->name,
                    'icon' => $transaction->category->icon,
                    'color' => $transaction->category->color,
                ] : null,
                'recurring' => $transaction->recurring_rule_id !== null,
            ]);

        $debts = Debt::query()
            ->ownedBy($user)
            ->whereNull('settled_at')
            ->whereNotNull('next_due_on')
            ->where('next_due_on', '<=', $until->toDateString())
            ->get()
            ->map(fn (Debt $debt) => [
                'type' => 'debt',
                'id' => $debt->id,
                'kind' => 'expense',
                'date' => $debt->next_due_on?->toDateString(),
                'overdue' => $debt->next_due_on?->lessThan($today) ?? false,
                'concept' => "Cuota · {$debt->creditor}",
                'amount' => $debt->installment !== null ? Money::toDecimal($debt->installment, $debt->currency) : null,
                'account' => null,
                'category' => null,
                'recurring' => true,
            ]);

        return $planned->concat($debts)
            ->sortBy('date')
            ->values()
            ->all();
    }
}
