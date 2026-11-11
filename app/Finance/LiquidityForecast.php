<?php

namespace App\Finance;

use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Debt;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use App\Support\MoneyFormatter;
use Carbon\CarbonImmutable;

/**
 * Previsión de liquidez: saldo real de hoy más cobros previstos menos pagos
 * previstos (y cuotas de deuda) día a día dentro de un horizonte.
 *
 * Es orientativa y explicable: devuelve los datos usados, los supuestos y
 * lo que falta, para que la interfaz nunca la presente como una certeza.
 */
class LiquidityForecast
{
    public function __construct(private readonly AccountBalances $balances) {}

    /**
     * @return array<string, mixed>|null null si no hay cuentas (sin información).
     */
    public function forUser(User $user, int $days = 30, ?CarbonImmutable $until = null): ?array
    {
        $accounts = Account::query()->ownedBy($user)->active()->pluck('id');

        if ($accounts->isEmpty()) {
            return null;
        }

        $today = $user->today();
        $until ??= $today->addDays($days);
        $currency = (string) $user->currency;
        $format = MoneyFormatter::for($user);

        $balances = $this->balances->forUser($user);
        $real = (int) $accounts->sum(fn (int $id) => $balances[$id] ?? 0);

        // Movimientos previstos (los atrasados sin confirmar se cuentan hoy).
        $planned = Transaction::query()
            ->ownedBy($user)
            ->whereIn('account_id', $accounts)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->whereIn('kind', [TransactionKind::Income->value, TransactionKind::Expense->value])
            ->where('occurred_on', '<=', $until->toDateString())
            ->get(['kind', 'amount', 'occurred_on']);

        $events = [];
        $overdue = 0;
        $plannedIncome = 0;
        $plannedExpense = 0;

        foreach ($planned as $movement) {
            $date = $movement->occurred_on->lessThan($today) ? $today : $movement->occurred_on;
            if ($movement->occurred_on->lessThan($today)) {
                $overdue++;
            }

            $signed = $movement->kind->sign() * $movement->amount;
            $events[$date->toDateString()][] = $signed;
            $signed > 0 ? $plannedIncome += $signed : $plannedExpense -= $signed;
        }

        // Cuotas de deuda indicadas por el usuario. Si ya existe un gasto
        // previsto del mismo importe en torno a esa fecha, se entiende que es
        // el mismo pago y no se descuenta dos veces.
        $installments = 0;
        $skippedInstallments = 0;
        $debts = Debt::query()->ownedBy($user)->whereNull('settled_at')
            ->whereNotNull('installment')->whereNotNull('next_due_on')->whereNotNull('frequency')->get();

        foreach ($debts as $debt) {
            $outstanding = $debt->outstanding();

            for ($n = 0, $due = $debt->next_due_on; $due !== null && $due->lessThanOrEqualTo($until) && $outstanding > 0; $n++) {
                $amount = min((int) $debt->installment, $outstanding);
                $date = $due->lessThan($today) ? $today : $due;

                $duplicate = $planned->contains(fn (Transaction $movement) => $movement->kind === TransactionKind::Expense
                    && $movement->amount === $amount
                    && abs($movement->occurred_on->diffInDays($due, false)) <= 3);

                if ($duplicate) {
                    $skippedInstallments++;
                } else {
                    $events[$date->toDateString()][] = -$amount;
                    $installments += $amount;
                }

                $outstanding -= $amount;
                $due = $debt->frequency?->occurrence($debt->next_due_on, $n + 1);
            }
        }

        ksort($events);

        $balance = $real;
        $timeline = [['date' => $today->toDateString(), 'balance' => Money::toDecimal($real, $currency)]];
        $lowest = $real;
        $lowestOn = $today;

        foreach ($events as $date => $amounts) {
            $balance += array_sum($amounts);
            $timeline[] = ['date' => $date, 'balance' => Money::toDecimal($balance, $currency)];

            if ($balance < $lowest) {
                $lowest = $balance;
                $lowestOn = CarbonImmutable::parse($date);
            }
        }

        if (end($timeline)['date'] !== $until->toDateString()) {
            $timeline[] = ['date' => $until->toDateString(), 'balance' => Money::toDecimal($balance, $currency)];
        }

        $assumptions = [
            'Parte del saldo real de tus cuentas activas: '.$format->money($real).'.',
            'Suma los cobros previstos ('.$format->money($plannedIncome).') y resta los pagos previstos ('.$format->money($plannedExpense).') hasta el '.$format->day($until).'.',
        ];
        if ($installments > 0) {
            $assumptions[] = 'Resta las cuotas de deuda que indicaste ('.$format->money($installments).').';
        }
        if ($skippedInstallments > 0) {
            $assumptions[] = 'No resta '.$skippedInstallments.' cuota(s) de deuda porque ya hay un pago previsto igual en esas fechas.';
        }
        if ($overdue > 0) {
            $assumptions[] = "Hay {$overdue} previsto(s) con fecha pasada sin confirmar: se cuentan como si ocurrieran hoy.";
        }
        $assumptions[] = 'No incluye gastos que no hayas registrado como previstos.';

        return [
            'from' => $today->toDateString(),
            'until' => $until->toDateString(),
            'real' => Money::toDecimal($real, $currency),
            'planned_income' => Money::toDecimal($plannedIncome, $currency),
            'planned_expense' => Money::toDecimal($plannedExpense, $currency),
            'installments' => Money::toDecimal($installments, $currency),
            'projected' => Money::toDecimal($balance, $currency),
            'lowest' => Money::toDecimal($lowest, $currency),
            'lowest_on' => $lowestOn->toDateString(),
            'shortfall' => $lowest < 0 ? Money::toDecimal(-$lowest, $currency) : null,
            'overdue' => $overdue,
            'timeline' => $timeline,
            'assumptions' => $assumptions,
            // Valores en unidades menores para otros cálculos del servidor.
            'minor' => ['real' => $real, 'projected' => $balance, 'lowest' => $lowest],
        ];
    }
}
