import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    CalendarClock,
    ChartColumn,
    CircleCheck,
    CircleHelp,
    Eye,
    HandHeart,
    Landmark,
    Minus,
    Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BalanceLineChart } from '@/components/charts/balance-line-chart';
import { ChartCard } from '@/components/charts/chart-card';
import { monthLabel } from '@/components/charts/chart-utils';
import { ColumnChart } from '@/components/charts/column-chart';
import { Explanation } from '@/components/charts/explanation';
import { CategoryIcon } from '@/components/finance/category-badge';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import { dashboard, statistics } from '@/routes';
import { index as accountsIndex } from '@/routes/accounts';
import { index as recurringIndex } from '@/routes/recurring';
import { index as transactionsIndex } from '@/routes/transactions';

type Tone = 'calm' | 'attention' | 'support' | 'unknown';

type Forecast = {
    from: string;
    until: string;
    real: string;
    planned_income: string;
    planned_expense: string;
    installments: string;
    projected: string;
    lowest: string;
    lowest_on: string;
    shortfall: string | null;
    overdue: number;
    timeline: { date: string; balance: string }[];
    assumptions: string[];
};

type Props = {
    headline: { tone: Tone; title: string; text: string };
    balance: string;
    month: { income: string; expense: string; net: string; debt_paid: string };
    forecast: Forecast | null;
    savings: {
        amount: string | null;
        has_margin?: boolean;
        explanation: string[];
    };
    evolution: {
        month: string;
        income: string;
        expense: string;
        net: string;
    }[];
    upcoming: {
        type: 'movement' | 'debt';
        id: number;
        kind: 'income' | 'expense';
        date: string;
        overdue: boolean;
        concept: string;
        amount: string | null;
    }[];
    budgets: {
        category: { id: number; name: string; icon: string; color: string };
        limit: string | null;
        spent: string;
        percent: number | null;
        status: string;
    }[];
    goals: {
        id: number;
        name: string;
        icon: string;
        color: string;
        saved: string;
        target_amount: string;
        percent: number;
    }[];
    quality: {
        has_accounts: boolean;
        has_movements: boolean;
        last_movement_on: string | null;
        stale: boolean;
        overdue_planned: number;
    };
};

const TONES: Record<Tone, { icon: LucideIcon; className: string }> = {
    calm: { icon: CircleCheck, className: 'bg-primary/10 text-primary' },
    attention: { icon: Eye, className: 'bg-accent text-accent-foreground' },
    support: { icon: HandHeart, className: 'bg-accent text-accent-foreground' },
    unknown: { icon: CircleHelp, className: 'bg-muted text-muted-foreground' },
};

export default function Dashboard(props: Props) {
    const {
        headline,
        balance,
        month,
        forecast,
        savings,
        evolution,
        upcoming,
        budgets,
        goals,
        quality,
    } = props;
    const { auth } = usePage().props;
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const firstName = auth.user.name.split(' ')[0];
    const tone = TONES[headline.tone];

    return (
        <>
            <Head title="Panel" />

            <div className="flex flex-col gap-5 p-4 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-sm text-muted-foreground">
                            Hola, {firstName}
                        </p>
                        <h1 className="text-2xl font-semibold">Tu situación</h1>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" asChild>
                            <Link
                                href={transactionsIndex({
                                    query: { new: 'expense' },
                                })}
                            >
                                <Minus aria-hidden="true" />
                                Gasto
                            </Link>
                        </Button>
                        <Button size="sm" variant="secondary" asChild>
                            <Link
                                href={transactionsIndex({
                                    query: { new: 'income' },
                                })}
                            >
                                <Plus aria-hidden="true" />
                                Ingreso
                            </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                            <Link
                                href={transactionsIndex({
                                    query: { new: 'transfer' },
                                })}
                            >
                                <ArrowLeftRight aria-hidden="true" />
                                <span className="sr-only sm:not-sr-only">
                                    Transferir
                                </span>
                            </Link>
                        </Button>
                    </div>
                </div>

                <section
                    aria-live="polite"
                    className="flex gap-4 rounded-2xl border bg-card p-5 shadow-xs"
                >
                    <span
                        className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-xl',
                            tone.className,
                        )}
                    >
                        <tone.icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1">
                        <h2 className="font-semibold">{headline.title}</h2>
                        <p className="text-sm text-muted-foreground">
                            {headline.text}
                        </p>
                        {headline.tone === 'support' && (
                            <Link
                                href={recurringIndex()}
                                className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                                Ver próximos vencimientos
                            </Link>
                        )}
                        {headline.tone === 'unknown' &&
                            !quality.has_accounts && (
                                <Link
                                    href={accountsIndex()}
                                    className="text-sm text-primary underline-offset-4 hover:underline"
                                >
                                    Añadir una cuenta
                                </Link>
                            )}
                    </div>
                </section>

                <section
                    aria-label="Resumen"
                    className="grid grid-cols-2 gap-3 lg:grid-cols-4"
                >
                    <Tile
                        label="Saldo real"
                        value={format.money(balance)}
                        hint="Movimientos confirmados"
                    />
                    <Tile
                        label="Ingresos del mes"
                        value={format.money(month.income)}
                        hint="Cobrados"
                    />
                    <Tile
                        label="Gastos del mes"
                        value={format.money(month.expense)}
                        hint="Pagados"
                    />
                    <Tile
                        label="Pagos de deuda"
                        value={format.money(month.debt_paid)}
                        hint="Este mes, capital e intereses"
                    />
                </section>

                <div className="grid gap-5 lg:grid-cols-3">
                    {forecast && (
                        <ChartCard
                            className="lg:col-span-2"
                            title="Saldo previsto"
                            summary={
                                <>
                                    De {format.money(forecast.real)} hoy a{' '}
                                    <strong className="text-foreground">
                                        {format.money(forecast.projected)}
                                    </strong>{' '}
                                    el {format.day(forecast.until)}. Punto más
                                    bajo: {format.money(forecast.lowest)} el{' '}
                                    {format.day(forecast.lowest_on)}.
                                </>
                            }
                            table={{
                                columns: ['Fecha', 'Saldo previsto'],
                                rows: forecast.timeline.map((p) => [
                                    format.day(p.date),
                                    format.money(p.balance),
                                ]),
                            }}
                            footer={
                                <Explanation items={forecast.assumptions} />
                            }
                        >
                            <BalanceLineChart
                                points={forecast.timeline.map((p) => ({
                                    date: p.date,
                                    value: p.balance,
                                }))}
                                ariaLabel="Evolución prevista del saldo"
                                step
                                markLowest
                            />
                        </ChartCard>
                    )}

                    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
                        <h2 className="font-semibold">
                            Capacidad de ahorro estimada
                        </h2>
                        {savings.amount === null ? (
                            <p className="text-sm text-muted-foreground">
                                Sin información suficiente todavía.
                            </p>
                        ) : (
                            <>
                                <p className="text-3xl font-semibold tabular-nums">
                                    {format.money(savings.amount)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {savings.has_margin
                                        ? 'Margen que podrías apartar este mes sin quedarte corto con lo previsto.'
                                        : 'Este mes no queda margen después de tus pagos previstos y reservas.'}
                                </p>
                            </>
                        )}
                        <Explanation items={savings.explanation} />
                    </section>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="font-semibold">Próximos 14 días</h2>
                            <Link
                                href={recurringIndex()}
                                className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                                Ver todo
                            </Link>
                        </div>
                        {upcoming.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No hay cobros ni pagos previstos.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {upcoming.map((item) => (
                                    <li
                                        key={`${item.type}-${item.id}`}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <CalendarClock
                                            className="size-4 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {item.concept}
                                            <span className="block text-xs text-muted-foreground">
                                                {format.day(item.date)}
                                                {item.overdue &&
                                                    ' · fecha pasada'}
                                            </span>
                                        </span>
                                        {item.amount && (
                                            <span
                                                className={cn(
                                                    'shrink-0 font-medium tabular-nums',
                                                    item.kind === 'income' &&
                                                        'text-primary',
                                                )}
                                            >
                                                {item.kind === 'income'
                                                    ? '+'
                                                    : '−'}{' '}
                                                {format.money(item.amount)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <ChartCard
                        className="lg:col-span-2"
                        title="Ingresos y gastos"
                        summary={`Últimos ${evolution.length} meses, solo movimientos confirmados. Las transferencias y el capital de las deudas no cuentan.`}
                        legend={[
                            { label: 'Ingresos', color: 'var(--series-1)' },
                            { label: 'Gastos', color: 'var(--series-2)' },
                        ]}
                        table={{
                            columns: [
                                'Mes',
                                'Ingresos',
                                'Gastos',
                                'Diferencia',
                            ],
                            rows: evolution.map((row) => [
                                monthLabel(row.month, locale, 'long'),
                                format.money(row.income),
                                format.money(row.expense),
                                format.money(row.net),
                            ]),
                        }}
                        actions={
                            <Button size="sm" variant="ghost" asChild>
                                <Link href={statistics()}>
                                    <ChartColumn aria-hidden="true" />
                                    Estadísticas
                                </Link>
                            </Button>
                        }
                    >
                        <ColumnChart
                            ariaLabel="Ingresos y gastos por mes"
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
                            data={evolution.map((row) => ({
                                key: row.month,
                                label: monthLabel(row.month, locale),
                                values: {
                                    income: row.income,
                                    expense: row.expense,
                                },
                            }))}
                        />
                    </ChartCard>
                </div>

                {(budgets.length > 0 || goals.length > 0) && (
                    <div className="grid gap-5 lg:grid-cols-2">
                        {budgets.length > 0 && (
                            <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
                                <h2 className="font-semibold">
                                    Presupuestos del mes
                                </h2>
                                <ul className="space-y-3">
                                    {budgets.map((row) => (
                                        <li
                                            key={row.category.id}
                                            className="space-y-1"
                                        >
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="flex items-center gap-2">
                                                    <CategoryIcon
                                                        icon={row.category.icon}
                                                        color={
                                                            row.category.color
                                                        }
                                                        className="size-7"
                                                    />
                                                    {row.category.name}
                                                </span>
                                                <span className="text-muted-foreground tabular-nums">
                                                    {format.money(row.spent)} /{' '}
                                                    {format.money(
                                                        row.limit ?? '0',
                                                    )}
                                                </span>
                                            </div>
                                            <ProgressBar
                                                value={row.percent ?? 0}
                                                label={`Presupuesto de ${row.category.name}`}
                                                valueText={`${row.percent ?? 0} %`}
                                                tone={
                                                    row.status === 'over' ||
                                                    row.status ===
                                                        'over_planned'
                                                        ? 'warning'
                                                        : 'default'
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {goals.length > 0 && (
                            <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
                                <h2 className="font-semibold">Objetivos</h2>
                                <ul className="space-y-3">
                                    {goals.map((goal) => (
                                        <li key={goal.id} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="flex items-center gap-2">
                                                    <CategoryIcon
                                                        icon={goal.icon}
                                                        color={goal.color}
                                                        className="size-7"
                                                    />
                                                    {goal.name}
                                                </span>
                                                <span className="text-muted-foreground tabular-nums">
                                                    {goal.percent} %
                                                </span>
                                            </div>
                                            <ProgressBar
                                                value={goal.percent}
                                                label={`Progreso de ${goal.name}`}
                                                valueText={`${format.money(goal.saved)} de ${format.money(goal.target_amount)}`}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                )}

                {!quality.has_movements && quality.has_accounts && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Landmark className="size-4" aria-hidden="true" />
                        Registra tus primeros movimientos para ver tu evolución.
                    </p>
                )}
            </div>
        </>
    );
}

function Tile({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint: string;
}) {
    return (
        <div className="rounded-2xl border bg-card p-4 shadow-xs">
            <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">
                {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Panel', href: dashboard() }],
};
