import { Head, router } from '@inertiajs/react';
import { CircleCheck, Sparkles } from 'lucide-react';
import { BalanceLineChart } from '@/components/charts/balance-line-chart';
import { CategoryBars } from '@/components/charts/category-bars';
import type { CategoryBreakdown } from '@/components/charts/category-bars';
import { ChartCard } from '@/components/charts/chart-card';
import { monthLabel } from '@/components/charts/chart-utils';
import { ColumnChart } from '@/components/charts/column-chart';
import { Explanation } from '@/components/charts/explanation';
import Heading from '@/components/heading';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useFormat } from '@/hooks/use-format';
import { statistics } from '@/routes';

type Props = {
    filters: { months: number; days: number; month: string };
    periods: number[];
    forecastOptions: number[];
    evolution: {
        month: string;
        income: string;
        expense: string;
        net: string;
    }[];
    categories: CategoryBreakdown;
    incomeCategories: CategoryBreakdown;
    comparison: {
        label: string;
        month: string;
        income: string;
        expense: string;
        net: string;
        has_data: boolean;
    }[];
    debt: { month: string; outstanding: string }[];
    budgets: { month: string; met: number; total: number }[];
    goals: {
        id: number;
        name: string;
        saved: string;
        target_amount: string;
        percent: number;
        achieved: boolean;
    }[];
    forecast: {
        until: string;
        real: string;
        projected: string;
        lowest: string;
        lowest_on: string;
        shortfall: string | null;
        timeline: { date: string; balance: string }[];
        assumptions: string[];
    } | null;
    savings: {
        amount: string | null;
        has_margin?: boolean;
        explanation: string[];
    };
    quality: {
        has_movements: boolean;
        last_movement_on: string | null;
        stale: boolean;
    };
};

export default function StatisticsIndex(props: Props) {
    const {
        filters,
        periods,
        forecastOptions,
        evolution,
        categories,
        incomeCategories,
        comparison,
        debt,
        budgets,
        goals,
        forecast,
        quality,
    } = props;
    const format = useFormat();
    const locale = format.preferences.number_locale;

    const update = (changes: Partial<Props['filters']>) =>
        router.get(
            statistics.url({ query: { ...filters, ...changes } }),
            {},
            { preserveState: true, preserveScroll: true },
        );

    // Solo elige qué mes destacar en el resumen; las cifras vienen del servidor.
    const best = [...evolution].sort(
        (a, b) => Number(b.net) - Number(a.net),
    )[0];

    return (
        <>
            <Head title="Estadísticas" />

            <div className="flex flex-col gap-5 p-4 md:p-6">
                <Heading
                    title="Estadísticas"
                    description="Cómo evolucionan tus ingresos, gastos, deudas y objetivos."
                />

                {/* Filtros: una fila encima de todo lo que acotan. */}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-1">
                        <Label htmlFor="stats-months" className="text-xs">
                            Periodo
                        </Label>
                        <NativeSelect
                            id="stats-months"
                            value={filters.months}
                            onChange={(e) =>
                                update({ months: Number(e.target.value) })
                            }
                        >
                            {periods.map((p) => (
                                <option key={p} value={p}>
                                    Últimos {p} meses
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor="stats-days" className="text-xs">
                            Previsión
                        </Label>
                        <NativeSelect
                            id="stats-days"
                            value={filters.days}
                            onChange={(e) =>
                                update({ days: Number(e.target.value) })
                            }
                        >
                            {forecastOptions.map((d) => (
                                <option key={d} value={d}>
                                    Próximos {d} días
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                </div>

                {!quality.has_movements && (
                    <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                        Todavía no hay movimientos confirmados: las estadísticas
                        aparecerán cuando registres los primeros.
                    </p>
                )}
                {quality.stale && quality.last_movement_on && (
                    <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                        Tu último movimiento es del{' '}
                        {format.day(quality.last_movement_on)}. Si faltan
                        movimientos por registrar, estas cifras pueden no
                        reflejar tu situación actual.
                    </p>
                )}

                <ChartCard
                    title="Ingresos y gastos por mes"
                    summary={
                        best && Number(best.net) !== 0
                            ? `El mes con mayor diferencia a favor fue ${monthLabel(best.month, locale, 'long')} (${format.money(best.net)}).`
                            : 'Solo movimientos confirmados; las transferencias y el capital de deudas no cuentan.'
                    }
                    legend={[
                        { label: 'Ingresos', color: 'var(--series-1)' },
                        { label: 'Gastos', color: 'var(--series-2)' },
                    ]}
                    table={{
                        columns: ['Mes', 'Ingresos', 'Gastos', 'Diferencia'],
                        rows: evolution.map((r) => [
                            monthLabel(r.month, locale, 'long'),
                            format.money(r.income),
                            format.money(r.expense),
                            format.money(r.net),
                        ]),
                    }}
                >
                    <ColumnChart
                        ariaLabel="Ingresos y gastos por mes"
                        height={240}
                        series={[
                            {
                                key: 'income',
                                label: 'Ingresos',
                                color: 'var(--series-1)',
                            },
                            {
                                key: 'expense',
                                label: 'Gastos',
                                color: 'var(--series-2)',
                            },
                        ]}
                        data={evolution.map((r) => ({
                            key: r.month,
                            label: monthLabel(r.month, locale),
                            values: { income: r.income, expense: r.expense },
                        }))}
                    />
                </ChartCard>

                <div className="grid gap-5 lg:grid-cols-2">
                    <ChartCard
                        title="¿En qué gastas?"
                        summary={
                            categories.rows.length > 0
                                ? `${format.money(categories.total)} en el periodo. La categoría principal es ${categories.rows[0].category.name} (${format.percent(categories.rows[0].share)}).`
                                : 'Sin gastos confirmados en el periodo.'
                        }
                        table={{
                            columns: ['Categoría', 'Importe', '%'],
                            rows: [
                                ...categories.rows.map((r) => [
                                    r.category.name,
                                    format.money(r.amount),
                                    format.percent(r.share),
                                ]),
                                ...(categories.other
                                    ? [
                                          [
                                              `Otras (${categories.other.count})`,
                                              format.money(
                                                  categories.other.amount,
                                              ),
                                              format.percent(
                                                  categories.other.share,
                                              ),
                                          ],
                                      ]
                                    : []),
                            ],
                        }}
                    >
                        <CategoryBars breakdown={categories} />
                    </ChartCard>

                    <ChartCard
                        title="¿De dónde vienen tus ingresos?"
                        summary={
                            incomeCategories.rows.length > 0
                                ? `${format.money(incomeCategories.total)} en el periodo.`
                                : 'Sin ingresos confirmados en el periodo.'
                        }
                        table={{
                            columns: ['Categoría', 'Importe', '%'],
                            rows: incomeCategories.rows.map((r) => [
                                r.category.name,
                                format.money(r.amount),
                                format.percent(r.share),
                            ]),
                        }}
                    >
                        <CategoryBars breakdown={incomeCategories} />
                    </ChartCard>
                </div>

                <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
                    <h2 className="font-semibold">
                        Comparación con periodos equivalentes
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th
                                        scope="col"
                                        className="py-2 pr-3 font-medium"
                                    >
                                        Periodo
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2 pr-3 text-right font-medium"
                                    >
                                        Ingresos
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2 pr-3 text-right font-medium"
                                    >
                                        Gastos
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2 text-right font-medium"
                                    >
                                        Diferencia
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparison.map((row) => (
                                    <tr
                                        key={row.month}
                                        className="border-b last:border-0"
                                    >
                                        <th
                                            scope="row"
                                            className="py-2 pr-3 text-left font-normal"
                                        >
                                            {row.label}
                                            <span className="block text-xs text-muted-foreground first-letter:uppercase">
                                                {monthLabel(
                                                    row.month,
                                                    locale,
                                                    'long',
                                                )}
                                            </span>
                                        </th>
                                        {row.has_data ? (
                                            <>
                                                <td className="py-2 pr-3 text-right tabular-nums">
                                                    {format.money(row.income)}
                                                </td>
                                                <td className="py-2 pr-3 text-right tabular-nums">
                                                    {format.money(row.expense)}
                                                </td>
                                                <td className="py-2 text-right font-medium tabular-nums">
                                                    {format.money(row.net)}
                                                </td>
                                            </>
                                        ) : (
                                            <td
                                                colSpan={3}
                                                className="py-2 text-right text-xs text-muted-foreground"
                                            >
                                                Sin datos registrados
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {forecast && (
                    <ChartCard
                        title="Previsión de liquidez"
                        summary={
                            forecast.shortfall
                                ? `Con lo registrado, el saldo bajaría hasta ${format.money(forecast.lowest)} el ${format.day(forecast.lowest_on)}: faltarían ${format.money(forecast.shortfall)}.`
                                : `El saldo previsto pasa de ${format.money(forecast.real)} a ${format.money(forecast.projected)} el ${format.day(forecast.until)}; el punto más bajo es ${format.money(forecast.lowest)}.`
                        }
                        table={{
                            columns: ['Fecha', 'Saldo previsto'],
                            rows: forecast.timeline.map((p) => [
                                format.day(p.date),
                                format.money(p.balance),
                            ]),
                        }}
                        footer={<Explanation items={forecast.assumptions} />}
                    >
                        <BalanceLineChart
                            ariaLabel="Previsión del saldo"
                            points={forecast.timeline.map((p) => ({
                                date: p.date,
                                value: p.balance,
                            }))}
                            step
                            markLowest
                            height={240}
                        />
                    </ChartCard>
                )}

                <div className="grid gap-5 lg:grid-cols-2">
                    {debt.length > 0 && (
                        <ChartCard
                            title="Capital pendiente de tus deudas"
                            summary={`De ${format.money(debt[0].outstanding)} a ${format.money(debt[debt.length - 1].outstanding)} al cierre de cada mes.`}
                            table={{
                                columns: ['Mes', 'Pendiente'],
                                rows: debt.map((r) => [
                                    monthLabel(r.month, locale, 'long'),
                                    format.money(r.outstanding),
                                ]),
                            }}
                        >
                            <BalanceLineChart
                                ariaLabel="Capital pendiente al cierre de cada mes"
                                points={debt.map((r) => ({
                                    date: r.month,
                                    value: r.outstanding,
                                }))}
                                monthly
                                color="var(--series-2)"
                            />
                        </ChartCard>
                    )}

                    {budgets.length > 0 && (
                        <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
                            <h2 className="font-semibold">
                                Cumplimiento de presupuestos
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Categorías que no superaron su límite cada mes
                                (con los límites actuales).
                            </p>
                            <ul className="space-y-2">
                                {budgets.map((row) => (
                                    <li key={row.month} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="first-letter:uppercase">
                                                {monthLabel(
                                                    row.month,
                                                    locale,
                                                    'long',
                                                )}
                                            </span>
                                            <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
                                                {row.met === row.total && (
                                                    <CircleCheck
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {row.met} de {row.total}
                                            </span>
                                        </div>
                                        <ProgressBar
                                            value={
                                                row.total > 0
                                                    ? (row.met / row.total) *
                                                      100
                                                    : 0
                                            }
                                            label={`Presupuestos cumplidos en ${monthLabel(row.month, locale, 'long')}`}
                                            valueText={`${row.met} de ${row.total}`}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {goals.length > 0 && (
                        <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
                            <h2 className="font-semibold">
                                Objetivos de ahorro
                            </h2>
                            <ul className="space-y-3">
                                {goals.map((goal) => (
                                    <li key={goal.id} className="space-y-1">
                                        <div className="flex justify-between gap-2 text-sm">
                                            <span className="flex items-center gap-1">
                                                {goal.achieved && (
                                                    <Sparkles
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {goal.name}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums">
                                                {format.money(goal.saved)} /{' '}
                                                {format.money(
                                                    goal.target_amount,
                                                )}
                                            </span>
                                        </div>
                                        <ProgressBar
                                            value={goal.percent}
                                            label={`Progreso de ${goal.name}`}
                                            valueText={`${goal.percent} %`}
                                            tone={
                                                goal.achieved
                                                    ? 'done'
                                                    : 'default'
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
        </>
    );
}

StatisticsIndex.layout = {
    breadcrumbs: [{ title: 'Estadísticas', href: statistics() }],
};
