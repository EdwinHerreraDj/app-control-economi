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
        $expectedOut = array_sum(array_column(array_filter($payments, $inMonth), 'minor'))
            + array_sum(array_column(array_filter($installments, $inMonth), 'minor'));

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
}
