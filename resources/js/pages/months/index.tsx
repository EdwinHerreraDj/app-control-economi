import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    HandCoins,
} from 'lucide-react';
import { CategoryIcon } from '@/components/finance/category-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import { index as monthsIndex } from '@/routes/months';

type Movement = {
    id: number;
    kind: string;
    concept: string;
    amount: string;
    date: string;
    account: string;
    to_account: string | null;
    category: { name: string; icon: string; color: string } | null;
    spending_type: string | null;
    habitual: boolean;
    debt: boolean;
};

type Props = {
    summary: {
        month: string;
        received: string;
        spent: string;
        habitual: string;
        treats: string;
        other_spending: string;
        debt_paid: string;
        result: string;
        movements: Movement[];
        pending: number;
    };
    previous: string;
    next: string | null;
    isCurrent: boolean;
};

function monthTitle(month: string, locale: string): string {
    const [year, number] = month.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, number - 1, 1)));
}

export default function Months({ summary, previous, next, isCurrent }: Props) {
    const format = useFormat();
    const result = Number(summary.result);

    // Movimientos agrupados por día, del más reciente al más antiguo.
    const days = summary.movements.reduce<Record<string, Movement[]>>(
        (groups, movement) => {
            (groups[movement.date] ??= []).push(movement);

            return groups;
        },
        {},
    );

    const breakdown = [
        ['Pagos habituales', summary.habitual],
        ['Gustos que te diste', summary.treats],
        ['Otros gastos', summary.other_spending],
    ].filter(([, value]) => Number(value) !== 0);

    return (
        <>
            <Head title="Mis meses" />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
                <header className="flex items-center justify-between gap-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link
                            href={monthsIndex({ query: { month: previous } })}
                            aria-label="Mes anterior"
                            preserveScroll
                        >
                            <ChevronLeft aria-hidden="true" />
                        </Link>
                    </Button>
                    <h1 className="text-center text-2xl font-semibold first-letter:uppercase">
                        {monthTitle(
                            summary.month,
                            format.preferences.number_locale,
                        )}
                    </h1>
                    {next ? (
                        <Button variant="ghost" size="icon" asChild>
                            <Link
                                href={monthsIndex({ query: { month: next } })}
                                aria-label="Mes siguiente"
                                preserveScroll
                            >
                                <ChevronRight aria-hidden="true" />
                            </Link>
                        </Button>
                    ) : (
                        <span className="size-9" aria-hidden="true" />
                    )}
                </header>

                <section className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-income-soft p-4">
                        <p className="text-sm text-muted-foreground">
                            Te entró
                        </p>
                        <p className="text-2xl font-semibold text-income tabular-nums">
                            {format.money(summary.received)}
                        </p>
                    </div>
                    <div className="rounded-2xl bg-expense-soft p-4">
                        <p className="text-sm text-muted-foreground">
                            Gastaste
                        </p>
                        <p className="text-2xl font-semibold text-expense tabular-nums">
                            {format.money(summary.spent)}
                        </p>
                    </div>
                </section>

                {(breakdown.length > 0 || Number(summary.debt_paid) > 0) && (
                    <section className="rounded-2xl border bg-card p-4">
                        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                            En qué se fue
                        </h2>
                        <dl className="divide-y text-sm">
                            {breakdown.map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex justify-between gap-3 py-2"
                                >
                                    <dt>{label}</dt>
                                    <dd className="font-medium tabular-nums">
                                        {format.money(value)}
                                    </dd>
                                </div>
                            ))}
                            {Number(summary.debt_paid) > 0 && (
                                <div className="flex justify-between gap-3 py-2">
                                    <dt>Cuotas de deudas</dt>
                                    <dd className="font-medium tabular-nums">
                                        {format.money(summary.debt_paid)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </section>
                )}

                <section
                    className={cn(
                        'rounded-2xl p-4',
                        result >= 0 ? 'bg-income-soft' : 'bg-expense-soft',
                    )}
                >
                    <p className="text-sm text-muted-foreground">
                        {isCurrent
                            ? 'Por ahora, este mes'
                            : 'Resultado del mes'}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                        {result >= 0 ? '+ ' : ''}
                        {format.money(summary.result)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {result >= 0
                            ? 'Te entró más de lo que salió.'
                            : 'Salió más de lo que te entró.'}
                        {summary.pending > 0 &&
                            ` Aún tienes ${summary.pending} ${summary.pending === 1 ? 'pago o cobro pendiente' : 'pagos o cobros pendientes'} este mes.`}
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Movimientos</h2>
                    {summary.movements.length === 0 ? (
                        <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                            No apuntaste nada este mes.
                        </p>
                    ) : (
                        Object.entries(days).map(([day, items]) => (
                            <div key={day}>
                                <h3 className="mb-1 text-xs font-medium text-muted-foreground first-letter:uppercase">
                                    {format.day(day)}
                                </h3>
                                <ul className="divide-y rounded-2xl border bg-card">
                                    {items.map((m) => {
                                        const isIncome = m.kind === 'income';
                                        const isTransfer =
                                            m.kind === 'transfer_out';

                                        return (
                                            <li
                                                key={m.id}
                                                className="flex items-center gap-3 p-3"
                                            >
                                                {m.category ? (
                                                    <CategoryIcon
                                                        icon={m.category.icon}
                                                        color={m.category.color}
                                                    />
                                                ) : (
                                                    <span
                                                        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary"
                                                        aria-hidden="true"
                                                    >
                                                        {isTransfer ? (
                                                            <ArrowLeftRight className="size-4.5" />
                                                        ) : (
                                                            <HandCoins className="size-4.5" />
                                                        )}
                                                    </span>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium">
                                                        {m.concept}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {isTransfer
                                                            ? `${m.account} → ${m.to_account}`
                                                            : (m.category
                                                                  ?.name ??
                                                              m.account)}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span
                                                        className={cn(
                                                            'font-semibold tabular-nums',
                                                            isIncome &&
                                                                'text-primary',
                                                        )}
                                                    >
                                                        {isIncome
                                                            ? '+ '
                                                            : isTransfer
                                                              ? ''
                                                              : '− '}
                                                        {format.money(m.amount)}
                                                    </span>
                                                    {m.spending_type ===
                                                        'treat' && (
                                                        <Badge variant="outline">
                                                            Un gusto
                                                        </Badge>
                                                    )}
                                                    {m.habitual && (
                                                        <Badge variant="outline">
                                                            Habitual
                                                        </Badge>
                                                    )}
                                                    {m.debt && (
                                                        <Badge variant="outline">
                                                            Deuda
                                                        </Badge>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))
                    )}
                </section>
            </div>
        </>
    );
}

Months.layout = {
    breadcrumbs: [{ title: 'Mis meses', href: monthsIndex() }],
};
