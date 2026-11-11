<?php

namespace App\Finance;

use App\Enums\SpendingType;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * «Mis meses»: lo que pasó en un mes concreto.
 *
 * Cada movimiento cuenta en el mes de su fecha real (aunque se apuntara
 * después) y una sola vez: las cuotas de deudas van aparte de los gastos y
 * las transferencias entre cuentas propias no son ni ingreso ni gasto.
 */
class MonthSummary
{
    public function __construct(private readonly MoneyOverview $overview) {}

    /**
     * @return array<string, mixed>
     */
    public function forMonth(User $user, CarbonImmutable $month): array
    {
        $currency = (string) $user->currency;
        $money = fn (int $minor) => Money::toDecimal($minor, $currency);
        $from = $month->startOfMonth();
        $to = $month->endOfMonth();

        $totals = $this->overview->monthTotals($user, $from, $to);

        $expenses = fn () => Transaction::query()->ownedBy($user)
            ->where('kind', TransactionKind::Expense->value)
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            ->whereNull('debt_payment_id')
            ->where('occurred_on', '>=', $from->toDateString())->where('occurred_on', '<', $to->addDay()->toDateString());

        // Habituales: los que vienen de un pago que se repite o los que la
        // persona marcó así. Gustos: los que marcó como «un gusto».
        $habitual = (int) $expenses()->where(fn (Builder $query) => $query
            ->whereNotNull('recurring_rule_id')
            ->orWhere('spending_type', SpendingType::Habitual->value))->sum('amount');
        $treats = (int) $expenses()->whereNull('recurring_rule_id')
            ->where('spending_type', SpendingType::Treat->value)->sum('amount');

        $movements = Transaction::query()->ownedBy($user)
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            // Cada transferencia aparece una sola vez (su salida).
            ->where('kind', '!=', TransactionKind::TransferIn->value)
            ->where('occurred_on', '>=', $from->toDateString())->where('occurred_on', '<', $to->addDay()->toDateString())
            ->with(['account:id,name', 'category:id,name,icon,color', 'transfer.toAccount:id,name'])
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->limit(300)
            ->get()
            ->map(fn (Transaction $t) => [
                'id' => $t->id,
                'kind' => $t->kind->value,
                'concept' => $t->concept,
                'amount' => Money::toDecimal($t->amount, $t->currency),
                'date' => $t->occurred_on->toDateString(),
                'account' => $t->account->name,
                'to_account' => $t->transfer?->toAccount->name,
                'category' => $t->category ? [
                    'name' => $t->category->name,
                    'icon' => $t->category->icon,
                    'color' => $t->category->color,
                ] : null,
                'spending_type' => $t->spending_type?->value,
                'habitual' => $t->recurring_rule_id !== null,
                'debt' => $t->debt_id !== null,
            ])
            ->values()
            ->all();

        $pending = Transaction::query()->ownedBy($user)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->whereIn('kind', [TransactionKind::Income->value, TransactionKind::Expense->value])
            ->where('occurred_on', '>=', $from->toDateString())->where('occurred_on', '<', $to->addDay()->toDateString())
            ->count();

        return [
            'month' => $from->format('Y-m'),
            'received' => $money($totals['received']),
            'spent' => $money($totals['spent']),
            'habitual' => $money($habitual),
            'treats' => $money($treats),
            'other_spending' => $money($totals['spent'] - $habitual - $treats),
            'debt_paid' => $money($totals['debt_paid']),
            'result' => $money($totals['received'] - $totals['spent'] - $totals['debt_paid']),
            'movements' => $movements,
            'pending' => $pending,
        ];
    }
}
