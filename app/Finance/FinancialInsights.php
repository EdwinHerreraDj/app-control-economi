<?php

namespace App\Finance;

use App\Enums\CategoryKind;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use App\Support\MoneyFormatter;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Análisis y estadísticas. Todas las cifras se calculan aquí, en el
 * servidor y con enteros; la interfaz solo las presenta.
 *
 * Reglas comunes: solo cuentan los movimientos confirmados y no anulados;
 * las transferencias propias y el capital de las deudas no son ingresos ni
 * gastos; los intereses y comisiones sí son gasto.
 */
class FinancialInsights
{
    public function __construct(
        private readonly LiquidityForecast $forecast,
        private readonly BudgetReport $budgets,
    ) {}

    /**
     * Ingresos y gastos confirmados por mes, del más antiguo al actual.
     *
     * @return list<array{month: string, income: string, expense: string, net: string}>
     */
    public function monthlyTotals(User $user, int $months, ?CarbonImmutable $last = null): array
    {
        $last ??= $user->today()->startOfMonth();
        $currency = (string) $user->currency;
        $rows = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $start = $last->subMonthsNoOverflow($i)->startOfMonth();
            [$income, $expense] = $this->totals($user, $start, $start->endOfMonth());

            $rows[] = [
                'month' => $start->format('Y-m'),
                'income' => Money::toDecimal($income, $currency),
                'expense' => Money::toDecimal($expense, $currency),
                'net' => Money::toDecimal($income - $expense, $currency),
            ];
        }

        return $rows;
    }

    /**
     * Gastos (o ingresos) por categoría en un periodo, de mayor a menor.
     * Pasadas las `$limit` primeras, el resto se agrupa en «Otras».
     *
     * @return array{total: string, rows: array<int, array<string, mixed>>, other: array{count: int, amount: string, share: float}|null}
     */
    public function categoryBreakdown(User $user, CarbonImmutable $from, CarbonImmutable $to, CategoryKind $kind = CategoryKind::Expense, int $limit = 7): array
    {
        $currency = (string) $user->currency;

        $sums = $this->countable($user, $from, $to)
            ->where('kind', $kind->value)
            ->groupBy('category_id')
            ->selectRaw('category_id, SUM(amount) AS total')
            ->pluck('total', 'category_id')
            ->map(fn ($total) => (int) $total);

        $total = (int) $sums->sum();
        $categories = Category::query()->ownedBy($user)->whereIn('id', $sums->keys())->get()->keyBy('id');

        $sorted = $sums->sortDesc();
        $rest = $sorted->slice($limit);
        $restTotal = (int) $rest->sum();

        $rows = $sorted->take($limit)->map(fn (int $amount, $categoryId) => [
            'category' => [
                'id' => (int) $categoryId,
                'name' => $categories[$categoryId]->name ?? 'Sin categoría',
                'icon' => $categories[$categoryId]->icon ?? 'tag',
                'color' => $categories[$categoryId]->color ?? 'slate',
            ],
            'amount' => Money::toDecimal($amount, $currency),
            'share' => $total > 0 ? round($amount * 100 / $total, 1) : 0.0,
        ])->values()->all();

        return [
            'total' => Money::toDecimal($total, $currency),
            'rows' => $rows,
            'other' => $rest->isEmpty() ? null : [
                'count' => $rest->count(),
                'amount' => Money::toDecimal($restTotal, $currency),
                'share' => $total > 0 ? round($restTotal * 100 / $total, 1) : 0.0,
            ],
        ];
    }

    /**
     * Mes elegido frente al anterior y al mismo mes del año pasado.
     *
     * @return list<array{label: string, month: string, income: string, expense: string, net: string, has_data: bool}>
     */
    public function comparison(User $user, CarbonImmutable $month): array
    {
        $currency = (string) $user->currency;
        $periods = [
            'Este mes' => $month,
            'Mes anterior' => $month->subMonthNoOverflow(),
            'Mismo mes del año pasado' => $month->subYearNoOverflow(),
        ];

        $rows = [];
        foreach ($periods as $label => $start) {
            $start = $start->startOfMonth();
            [$income, $expense] = $this->totals($user, $start, $start->endOfMonth());
            $rows[] = [
                'label' => $label,
                'month' => $start->format('Y-m'),
                'income' => Money::toDecimal($income, $currency),
                'expense' => Money::toDecimal($expense, $currency),
                'net' => Money::toDecimal($income - $expense, $currency),
                'has_data' => $income > 0 || $expense > 0,
            ];
        }

        return $rows;
    }

    /**
     * Capital pendiente de todas las deudas al cierre de cada mes.
     *
     * @return list<array{month: string, outstanding: string}>
     */
    public function debtEvolution(User $user, int $months): array
    {
        $currency = (string) $user->currency;
        $last = $user->today()->startOfMonth();
        $debts = Debt::query()->ownedBy($user)->get(['id', 'principal', 'paid_before', 'started_on']);

        if ($debts->isEmpty()) {
            return [];
        }

        $rows = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $end = $last->subMonthsNoOverflow($i)->endOfMonth();
            $started = $debts->filter(fn (Debt $debt) => $debt->started_on->lessThanOrEqualTo($end));
            $repaid = (int) DebtPayment::query()
                ->ownedBy($user)
                ->whereIn('debt_id', $started->pluck('id'))
                ->whereNull('voided_at')
                ->where('paid_on', '<=', $end->toDateString())
                ->sum('principal_amount');

            $rows[] = [
                'month' => $end->format('Y-m'),
                'outstanding' => Money::toDecimal(max(0, (int) $started->sum('principal') - (int) $started->sum('paid_before') - $repaid), $currency),
            ];
        }

        return $rows;
    }

    /**
     * Cumplimiento de presupuestos por mes, con los límites actuales.
     *
     * @return list<array{month: string, met: int, total: int}>
     */
    public function budgetCompliance(User $user, int $months): array
    {
        if (! Budget::query()->ownedBy($user)->exists()) {
            return [];
        }

        $last = $user->today()->startOfMonth();
        $rows = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $month = $last->subMonthsNoOverflow($i)->format('Y-m');
            $report = collect($this->budgets->forMonth($user, $month)['rows'])->where('status', '!=', 'none');

            $rows[] = [
                'month' => $month,
                'met' => $report->whereNotIn('status', ['over'])->count(),
                'total' => $report->count(),
            ];
        }

        return $rows;
    }

    /**
     * Capacidad estimada de ahorro hasta fin de mes.
     *
     * Parte del punto más bajo previsto del saldo (no del resultado del mes)
     * y descuenta lo ya reservado para objetivos y lo que queda por gastar
     * de los presupuestos. Cada compromiso se descuenta una sola vez: los
     * previstos ya están en la previsión y el presupuesto restante excluye
     * lo gastado y lo previsto.
     *
     * @return array<string, mixed>
     */
    public function savingsCapacity(User $user): array
    {
        $today = $user->today();
        $forecast = $this->forecast->forUser($user, until: $today->endOfMonth()->startOfDay());
        $format = MoneyFormatter::for($user);
        $currency = (string) $user->currency;

        if ($forecast === null) {
            return [
                'amount' => null,
                'explanation' => ['Aún no hay cuentas registradas: no hay datos para estimarlo.'],
            ];
        }

        $lowest = (int) $forecast['minor']['lowest'];

        $reserved = (int) SavingsGoal::query()->ownedBy($user)->whereNull('archived_at')
            ->withSum('contributions', 'amount')->get()->sum('contributions_sum_amount');

        $budgetRows = collect($this->budgets->forMonth($user, $today->format('Y-m'))['rows'])
            ->where('status', '!=', 'none');
        $budgetRemaining = (int) $budgetRows->sum(fn (array $row) => max(0, Money::toMinor((string) $row['remaining'], $currency, allowNegative: true)));

        $margin = $lowest - $reserved - $budgetRemaining;

        $explanation = [
            'Saldo más bajo previsto hasta el '.$format->day($today->endOfMonth()).': '.$format->money($lowest).'.',
        ];
        if ($reserved > 0) {
            $explanation[] = 'Menos lo reservado para tus objetivos: '.$format->money($reserved).'.';
        }
        if ($budgetRemaining > 0) {
            $explanation[] = 'Menos lo que queda por gastar de tus presupuestos este mes: '.$format->money($budgetRemaining).'.';
        }
        if ($budgetRows->isEmpty()) {
            $explanation[] = 'No tienes presupuestos: no se reserva nada para gastos variables que aún no hayas previsto, así que la cifra puede ser optimista.';
        }

        return [
            'amount' => Money::toDecimal(max(0, $margin), $currency),
            'has_margin' => $margin > 0,
            'explanation' => $explanation,
        ];
    }

    /**
     * Señales sobre la calidad de los datos, para no presentar como cierta
     * una estimación hecha con información incompleta o antigua.
     *
     * @return array<string, mixed>
     */
    public function dataQuality(User $user): array
    {
        $last = Transaction::query()->ownedBy($user)->countable()->max('occurred_on');
        $lastDate = $last !== null ? CarbonImmutable::parse($last) : null;
        $today = $user->today();

        return [
            'has_accounts' => $user->accounts()->whereNull('archived_at')->exists(),
            'has_movements' => $lastDate !== null,
            'last_movement_on' => $lastDate?->toDateString(),
            'stale' => $lastDate !== null && $lastDate->diffInDays($today) > 30,
            'overdue_planned' => Transaction::query()->ownedBy($user)
                ->where('status', TransactionStatus::Planned->value)->whereNull('voided_at')
                ->where('occurred_on', '<', $today->toDateString())->count(),
        ];
    }

    /**
     * Mensaje principal del panel: exacto, sin alarmismo ni culpa.
     *
     * @param  array<string, mixed>|null  $forecast
     * @param  array<string, mixed>  $quality
     * @return array{tone: string, title: string, text: string}
     */
    public function headline(User $user, ?array $forecast, array $quality): array
    {
        $format = MoneyFormatter::for($user);

        if ($forecast === null || ! $quality['has_accounts']) {
            return [
                'tone' => 'unknown',
                'title' => 'Aún no hay datos suficientes',
                'text' => 'Añade tus cuentas y algunos movimientos para ver aquí tu situación y una previsión.',
            ];
        }

        if ($forecast['shortfall'] !== null) {
            $shortfall = Money::toMinor($forecast['shortfall'], (string) $user->currency);

            return [
                'tone' => 'support',
                'title' => 'Se prevé un momento ajustado',
                'text' => 'Con los movimientos registrados, se prevé que falten '.$format->money($shortfall)
                    .' para cubrir los pagos hacia el '.$format->day(CarbonImmutable::parse($forecast['lowest_on']))
                    .'. Puedes revisar los próximos vencimientos.',
            ];
        }

        $lowest = (int) $forecast['minor']['lowest'];
        $real = max(1, (int) $forecast['minor']['real']);
        $attentionPercent = (int) config('finance.attention_margin_percent', 10);

        // Margen reducido: el punto más bajo queda por debajo de un % del saldo actual.
        if ($lowest * 100 < $real * $attentionPercent) {
            return [
                'tone' => 'attention',
                'title' => 'Margen reducido',
                'text' => 'Con lo previsto, tu saldo bajaría hasta '.$format->money($lowest)
                    .' hacia el '.$format->day(CarbonImmutable::parse($forecast['lowest_on'])).'.',
            ];
        }

        if ($quality['stale']) {
            return [
                'tone' => 'unknown',
                'title' => 'Datos sin actualizar',
                'text' => 'Tu último movimiento es del '.$format->day(CarbonImmutable::parse($quality['last_movement_on']))
                    .'. Si faltan movimientos por registrar, la previsión puede no reflejar tu situación.',
            ];
        }

        return [
            'tone' => 'calm',
            'title' => 'Todo previsto',
            'text' => 'Con los movimientos registrados, tus cuentas cubren los pagos previstos hasta el '
                .$format->day(CarbonImmutable::parse($forecast['until'])).'.',
        ];
    }

    /**
     * @return array{0: int, 1: int} Ingresos y gastos confirmados del periodo.
     */
    private function totals(User $user, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $sums = $this->countable($user, $from, $to)
            ->whereIn('kind', [TransactionKind::Income->value, TransactionKind::Expense->value])
            ->groupBy('kind')
            ->selectRaw('kind, SUM(amount) AS total')
            ->pluck('total', 'kind');

        return [(int) ($sums[TransactionKind::Income->value] ?? 0), (int) ($sums[TransactionKind::Expense->value] ?? 0)];
    }

    private function countable(User $user, CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return DB::table('transactions')
            ->where('user_id', $user->getKey())
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            ->whereBetween('occurred_on', [$from->toDateString(), $to->toDateString()]);
    }
}
