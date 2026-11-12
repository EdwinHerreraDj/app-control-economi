<?php

namespace App\Finance;

use App\Enums\AccountType;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;

/**
 * Resumen de «Mi dinero» para la pantalla de inicio.
 *
 * Separa siempre lo que la persona tiene de lo que espera: un cobro o un
 * pago pendiente nunca se suma ni se resta del dinero disponible hasta que
 * se marca como hecho. Todo se calcula con enteros (céntimos).
 */
class MoneyOverview
{
    /** Días hacia delante que se muestran como «próximos». */
    public const UPCOMING_DAYS = 30;

    public function __construct(private readonly AccountBalances $balances) {}

    /**
     * @return array<string, mixed>
     */
    public function forUser(User $user): array
    {
        $currency = (string) $user->currency;
        $money = fn (int $minor) => Money::toDecimal($minor, $currency);
        $today = $user->today();
        $monthStart = $today->startOfMonth();
        $monthEnd = $today->endOfMonth();

        // 1. ¿Cuánto tengo? Para gastar (bancos, efectivo…) y ahorrado aparte.
        $balances = $this->balances->forUser($user);
        $accounts = Account::query()->ownedBy($user)->active()->orderBy('name')->get();
        $available = 0;
        $saved = 0;
        $accountRows = [];

        foreach ($accounts as $account) {
            $balance = $balances[$account->id] ?? 0;
            $isSavings = $account->type === AccountType::Savings;
            $isSavings ? $saved += $balance : $available += $balance;
            $accountRows[] = [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type->value,
                'savings' => $isSavings,
                'balance' => $money($balance),
            ];
        }

        // 2 y 3. Este mes: lo que ha entrado y lo que se ha gastado. Las cuotas
        // de deudas van aparte para no contarlas dos veces.
        $month = $this->monthTotals($user, $monthStart, $monthEnd);

        // 4. Lo que toca pagar y cobrar pronto (incluye lo atrasado).
        $until = $today->addDays(self::UPCOMING_DAYS);
        $payments = $this->planned($user, TransactionKind::Expense, $until, $today);
        $incomes = $this->planned($user, TransactionKind::Income, $until, $today);
        $installments = $this->installments($user, $until, $today);

        // 5. ¿Cuánto debo todavía?
        $debts = Debt::query()->ownedBy($user)->whereNull('settled_at')->get();
        $owed = (int) $debts->sum(fn (Debt $debt) => $debt->outstanding());

        // Lo que podría quedar a final de mes: una estimación, nunca dinero
        // disponible. Solo cuenta lo previsto hasta el último día del mes.
        $inMonth = fn (array $item) => $item['date_minor'] <= $monthEnd->toDateString();
        $expectedIn = array_sum(array_column(array_filter($incomes, $inMonth), 'minor'));
        $pendingPayments = array_sum(array_column(array_filter($payments, $inMonth), 'minor'));
        // Cuotas de deudas que quedan este mes (también las atrasadas y las de
        // deudas con cuota pero sin fecha): son pagos de cada mes como los demás.
        $pendingInstallments = array_sum(array_column($this->debtSchedule($user, $today, $monthEnd, true), 'minor'));
        $expectedOut = $pendingPayments + $pendingInstallments;

        $clean = fn (array $items) => array_map(
            fn (array $item) => array_diff_key($item, ['minor' => true, 'date_minor' => true]),
            $items,
        );

        return [
            'available' => $money($available),
            'saved' => $money($saved),
            'has_savings_account' => $accounts->contains(fn (Account $a) => $a->type === AccountType::Savings),
            'accounts' => $accountRows,
            'month' => [
                'month' => $monthStart->format('Y-m'),
                'received' => $money($month['received']),
                'spent' => $money($month['spent']),
                'debt_paid' => $money($month['debt_paid']),
            ],
            'upcoming' => [
                'payments' => $clean($payments),
                'incomes' => $clean($incomes),
                'installments' => $clean($installments),
            ],
            'debts' => [
                'owed' => $money($owed),
                'count' => $debts->count(),
            ],
            // Gastos del mes: lo ya gastado más lo que queda por pagar hasta
            // el último día (pagos fijos pendientes y cuotas). Lo pendiente es
            // una previsión: aún no ha salido de tu dinero.
            'month_outlook' => [
                'spent' => $money($month['spent']),
                'debt_paid' => $money($month['debt_paid']),
                'pending_payments' => $money($pendingPayments),
                'pending_installments' => $money($pendingInstallments),
                'total' => $money($month['spent'] + $month['debt_paid'] + $expectedOut),
            ],
            'next_month' => $this->nextMonth($user, $monthStart->addMonthNoOverflow()),
            'end_of_month' => [
                'expected_in' => $money($expectedIn),
                'expected_out' => $money($expectedOut),
                'estimate' => $money($available + $expectedIn - $expectedOut),
                'until' => $monthEnd->toDateString(),
            ],
        ];
    }

    /**
     * @return array{received: int, spent: int, debt_paid: int}
     */
    public function monthTotals(User $user, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $base = fn () => Transaction::query()->ownedBy($user)
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            // Hasta el día siguiente sin incluirlo: así cuenta todo el último día
            // aunque la base de datos guarde la fecha con hora.
            ->where('occurred_on', '>=', $from->toDateString())
            ->where('occurred_on', '<', $to->addDay()->toDateString());

        return [
            'received' => (int) $base()->where('kind', TransactionKind::Income->value)->sum('amount'),
            // Los intereses de una cuota son gasto, pero se cuentan en «cuotas».
            'spent' => (int) $base()->where('kind', TransactionKind::Expense->value)->whereNull('debt_payment_id')->sum('amount'),
            'debt_paid' => (int) DebtPayment::query()->ownedBy($user)->whereNull('voided_at')
                ->where('paid_on', '>=', $from->toDateString())
                ->where('paid_on', '<', $to->addDay()->toDateString())
                ->selectRaw('COALESCE(SUM(principal_amount + interest_amount + fees_amount), 0) AS total')
                ->value('total'),
        ];
    }

    /**
     * Cobros o pagos pendientes de confirmar hasta una fecha.
     *
     * @return list<array<string, mixed>>
     */
    private function planned(User $user, TransactionKind $kind, CarbonImmutable $until, CarbonImmutable $today): array
    {
        return array_values(Transaction::query()->ownedBy($user)
            ->where('kind', $kind->value)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->where('occurred_on', '<', $until->addDay()->toDateString())
            ->with(['account:id,name', 'category:id,name,icon,color'])
            ->orderBy('occurred_on')
            ->limit(50)
            ->get()
            ->map(fn (Transaction $t) => [
                'id' => $t->id,
                'concept' => $t->concept,
                'amount' => Money::toDecimal($t->amount, $t->currency),
                'date' => $t->occurred_on->toDateString(),
                'overdue' => $t->occurred_on->toDateString() < $today->toDateString(),
                'account' => ['id' => $t->account->id, 'name' => $t->account->name],
                'category' => $t->category ? [
                    'name' => $t->category->name,
                    'icon' => $t->category->icon,
                    'color' => $t->category->color,
                ] : null,
                'recurring' => $t->recurring_rule_id !== null,
                'variable' => $t->nature?->value === 'variable',
                'minor' => $t->amount,
                'date_minor' => $t->occurred_on->toDateString(),
            ])
            ->all());
    }

    /**
     * Próximas cuotas de deudas (orientativas: las indica la persona).
     *
     * @return list<array<string, mixed>>
     */
    private function installments(User $user, CarbonImmutable $until, CarbonImmutable $today): array
    {
        return array_values(Debt::query()->ownedBy($user)
            ->whereNull('settled_at')
            ->whereNotNull('next_due_on')
            ->where('next_due_on', '<', $until->addDay()->toDateString())
            ->orderBy('next_due_on')
            ->get()
            ->map(function (Debt $debt) use ($today) {
                $outstanding = $debt->outstanding();
                $amount = min($debt->installment ?? $outstanding, $outstanding);
                /** @var CarbonImmutable $due */
                $due = $debt->next_due_on;

                return [
                    'id' => $debt->id,
                    'concept' => $debt->concept,
                    'amount' => Money::toDecimal($amount, $debt->currency),
                    'date' => $due->toDateString(),
                    'overdue' => $due->toDateString() < $today->toDateString(),
                    'minor' => $amount,
                    'date_minor' => $due->toDateString(),
                ];
            })
            ->all());
    }

    /**
     * El mes que viene: todo lo que habrá que pagar (pagos fijos y cuotas de
     * deudas) y lo que se espera cobrar. Es una previsión.
     *
     * @return array<string, mixed>
     */
    public function nextMonth(User $user, CarbonImmutable $month): array
    {
        $currency = (string) $user->currency;
        $money = fn (int $minor) => Money::toDecimal($minor, $currency);
        $from = $month->startOfMonth();
        $to = $month->endOfMonth();

        $planned = fn (TransactionKind $kind) => Transaction::query()->ownedBy($user)
            ->where('kind', $kind->value)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->where('occurred_on', '>=', $from->toDateString())
            ->where('occurred_on', '<', $to->addDay()->toDateString())
            ->with('category:id,name,icon,color')
            ->orderBy('occurred_on')
            ->get();

        $payments = $planned(TransactionKind::Expense);
        $incomes = $planned(TransactionKind::Income);
        // Las cuotas que vencen antes de ese mes ya se habrán pagado.
        $installments = $this->debtSchedule($user, $from, $to, false);

        $paymentsTotal = (int) $payments->sum('amount');
        $incomesTotal = (int) $incomes->sum('amount');
        $installmentsTotal = array_sum(array_column($installments, 'minor'));

        $items = [
            ...$payments->map(fn (Transaction $t) => [
                'key' => "p{$t->id}",
                'type' => 'payment',
                'concept' => $t->concept,
                'amount' => Money::toDecimal($t->amount, $t->currency),
                'date' => $t->occurred_on->toDateString(),
                'category' => $t->category ? ['icon' => $t->category->icon, 'color' => $t->category->color] : null,
            ])->all(),
            ...array_map(fn (array $item) => [
                'key' => "d{$item['id']}-".($item['date'] ?? 'mes'),
                'type' => 'installment',
                'concept' => $item['concept'],
                'amount' => $item['amount'],
                'date' => $item['date'],
                'category' => null,
            ], $installments),
        ];

        // Por fecha; las cuotas sin día fijo, al final.
        usort($items, fn (array $a, array $b) => ($a['date'] ?? '9999') <=> ($b['date'] ?? '9999'));

        return [
            'month' => $from->format('Y-m'),
            'payments' => $money($paymentsTotal),
            'installments' => $money($installmentsTotal),
            'total' => $money($paymentsTotal + $installmentsTotal),
            'incomes' => $money($incomesTotal),
            'free' => $money($incomesTotal - $paymentsTotal - $installmentsTotal),
            'items' => $items,
        ];
    }

    /**
     * Cuotas de deudas entre dos fechas, según su calendario: tantas como
     * venzan (una deuda semanal tiene varias al mes) y nunca más de lo que
     * falta por pagar. Las deudas con cuota pero sin fecha cuentan como una
     * cuota mensual que aún no se ha pagado ese mes.
     *
     * @return list<array{id: int, concept: string, amount: string, minor: int, date: string|null, overdue: bool}>
     */
    public function debtSchedule(User $user, CarbonImmutable $from, CarbonImmutable $to, bool $includeOverdue): array
    {
        $today = $user->today()->toDateString();
        $items = [];

        $debts = Debt::query()->ownedBy($user)
            ->whereNull('settled_at')
            ->where('installment', '>', 0)
            ->orderBy('next_due_on')
            ->get();

        foreach ($debts as $debt) {
            $remaining = $debt->outstanding();
            $installment = (int) $debt->installment;
            $add = function (?string $date, int $amount) use (&$items, $debt, $today) {
                $items[] = [
                    'id' => $debt->id,
                    'concept' => $debt->concept,
                    'amount' => Money::toDecimal($amount, $debt->currency),
                    'minor' => $amount,
                    'date' => $date,
                    'overdue' => $date !== null && $date < $today,
                ];
            };

            if ($debt->next_due_on !== null) {
                for ($n = 0; $n < 60 && $remaining > 0; $n++) {
                    $date = $debt->frequency !== null
                        ? $debt->frequency->occurrence($debt->next_due_on, $n)
                        : $debt->next_due_on;

                    if ($date->greaterThan($to) || ($debt->frequency === null && $n > 0)) {
                        break;
                    }

                    $amount = min($installment, $remaining);
                    $remaining -= $amount;

                    if ($date->greaterThanOrEqualTo($from) || $includeOverdue) {
                        $add($date->toDateString(), $amount);
                    }
                }

                continue;
            }

            // Sin fecha: una cuota al mes (dos si es quincenal, cuatro si es
            // semanal), menos las que ya se hayan pagado en ese mes.
            $perMonth = match ($debt->frequency?->value) {
                'weekly' => 4,
                'biweekly' => 2,
                'monthly', null => 1,
                default => 0,
            };
            $paidThisMonth = $debt->payments()->whereNull('voided_at')
                ->where('paid_on', '>=', $from->startOfMonth()->toDateString())
                ->where('paid_on', '<', $to->addDay()->toDateString())
                ->count();

            for ($i = $paidThisMonth; $i < $perMonth && $remaining > 0; $i++) {
                $amount = min($installment, $remaining);
                $remaining -= $amount;
                $add(null, $amount);
            }
        }

        return $items;
    }
}
