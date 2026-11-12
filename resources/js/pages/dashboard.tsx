import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    CalendarClock,
    HandCoins,
    Info,
    PiggyBank,
    Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { CategoryIcon } from '@/components/finance/category-badge';
import { MascotCompanion } from '@/components/mascot/mascot-companion';
import { PendingSyncNotice } from '@/components/offline/pending-sync-notice';
import {
    ConfirmPendingSheet,
    DebtPaymentSheet,
} from '@/components/payments/pay-sheets';
import type {
    InstallmentItem,
    PendingItem,
} from '@/components/payments/pay-sheets';
import { QuickButtons } from '@/components/quick/quick-add';
import { openQuick } from '@/components/quick/quick-store';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as monthsIndex } from '@/routes/months';
import { index as paymentsIndex } from '@/routes/payments';
import { show as setupShow } from '@/routes/setup';
import type { MascotCompanionData } from '@/types/branding';

type Upcoming = PendingItem & {
    category: { name: string; icon: string; color: string } | null;
    recurring: boolean;
};

type Props = {
    overview: {
        available: string;
        saved: string;
        has_savings_account: boolean;
        accounts: {
            id: number;
            name: string;
            type: string;
            savings: boolean;
            balance: string;
        }[];
        month: {
            month: string;
            received: string;
            spent: string;
            debt_paid: string;
        };
        upcoming: {
            payments: Upcoming[];
            incomes: Upcoming[];
            installments: InstallmentItem[];
        };
        debts: { owed: string; count: number };
        next_month: {
            month: string;
            payments: string;
            installments: string;
            total: string;
            incomes: string;
            free: string;
            items: {
                key: string;
                type: 'payment' | 'installment';
                concept: string;
                amount: string;
                date: string | null;
                category: { icon: string; color: string } | null;
            }[];
        };
        month_outlook: {
            spent: string;
            debt_paid: string;
            pending_payments: string;
            pending_installments: string;
            total: string;
        };
        end_of_month: {
            expected_in: string;
            expected_out: string;
            estimate: string;
            until: string;
        };
    };
    notices: { tone: 'warning' | 'info'; text: string }[];
    mascot: MascotCompanionData | null;
    needsSetup: boolean;
    firstName: string;
    today: string;
    interestCategoryId: number | null;
};

function Card({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            className={cn(
                'rounded-2xl border bg-card p-5 shadow-xs',
                className,
            )}
        >
            {children}
        </section>
    );
}

/**
 * «El mes que viene»: lo que tendrás que pagar (pagos fijos y cuotas de
 * deudas, que también son pagos de cada mes) y lo que esperas cobrar.
 */
function NextMonthCard({
    next,
    locale,
}: {
    next: Props['overview']['next_month'];
    locale: string;
}) {
    const format = useFormat();
    const [open, setOpen] = useState(false);
    const free = Number(next.free);
    const shown = open ? next.items : next.items.slice(0, 4);

    return (
        <Card>
            <h2 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
                En {monthName(next.month, locale)} tendrás que pagar
            </h2>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-expense tabular-nums">
                {format.money(next.total)}
            </p>

            <dl className="mt-3 grid gap-1.5 text-sm">
                <div className="flex justify-between gap-3">
                    <dt>Pagos fijos</dt>
                    <dd className="font-medium tabular-nums">
                        {format.money(next.payments)}
                    </dd>
                </div>
                <div className="flex justify-between gap-3">
                    <dt>Cuotas de deudas</dt>
                    <dd className="font-medium tabular-nums">
                        {format.money(next.installments)}
                    </dd>
                </div>
                {Number(next.incomes) > 0 && (
                    <>
                        <div className="flex justify-between gap-3">
                            <dt>Esperas cobrar</dt>
                            <dd className="font-medium text-income tabular-nums">
                                + {format.money(next.incomes)}
                            </dd>
                        </div>
                        <div
                            className={cn(
                                'mt-1 flex justify-between gap-3 rounded-xl px-3 py-2',
                                free >= 0
                                    ? 'bg-income-soft'
                                    : 'bg-warning-soft',
                            )}
                        >
                            <dt className="font-medium">
                                {free >= 0
                                    ? 'Te quedarían libres'
                                    : 'Te faltarían'}
                            </dt>
                            <dd
                                className={cn(
                                    'font-semibold tabular-nums',
                                    free >= 0 ? 'text-income' : 'text-warning',
                                )}
                            >
                                {format.money(next.free.replace('-', ''))}
                            </dd>
                        </div>
                    </>
                )}
            </dl>

            {next.items.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                    No tienes pagos fijos ni cuotas apuntados para ese mes.{' '}
                    <Link
                        href={paymentsIndex()}
                        className="text-primary underline-offset-4 hover:underline"
                    >
                        Apúntalos en Mis pagos
                    </Link>
                    .
                </p>
            ) : (
                <>
                    <ul className="mt-4 divide-y border-t">
                        {shown.map((item) => (
                            <li
                                key={item.key}
                                className="flex items-center gap-3 py-2.5 text-sm"
                            >
                                {item.category ? (
                                    <CategoryIcon
                                        icon={item.category.icon}
                                        color={item.category.color}
                                    />
                                ) : (
                                    <span
                                        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-savings-soft text-savings"
                                        aria-hidden="true"
                                    >
                                        <HandCoins className="size-4.5" />
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">
                                        {item.concept}
                                    </p>
                                    <p className="text-xs text-muted-foreground first-letter:uppercase">
                                        {item.type === 'installment'
                                            ? 'Cuota · '
                                            : ''}
                                        {item.date
                                            ? format.day(item.date)
                                            : 'sin día fijo'}
                                    </p>
                                </div>
                                <span className="font-semibold tabular-nums">
                                    {format.money(item.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {next.items.length > 4 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 w-full"
                            onClick={() => setOpen((value) => !value)}
                        >
                            {open
                                ? 'Ver menos'
                                : `Ver los ${next.items.length} pagos`}
                        </Button>
                    )}
                </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
                Es una previsión con tus pagos fijos y tus deudas: aún no ha
                salido nada de tu dinero.
            </p>
        </Card>
    );
}

function monthName(month: string, locale: string): string {
    const [year, number] = month.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        month: 'long',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, number - 1, 1)));
}

export default function Dashboard({
    overview,
    notices,
    mascot,
    needsSetup,
    firstName,
    today,
    interestCategoryId,
}: Props) {
    const format = useFormat();
    const [paying, setPaying] = useState<PendingItem | null>(null);
    const [collecting, setCollecting] = useState<PendingItem | null>(null);
    const [installment, setInstallment] = useState<InstallmentItem | null>(
        null,
    );

    const {
        upcoming,
        month,
        debts,
        end_of_month: end,
        month_outlook: outlook,
    } = overview;
    // Parte ya gastada frente a lo que queda por pagar (para la barra).
    const outlookTotal = Number(outlook.total);
    const outlookDone = Number(outlook.spent) + Number(outlook.debt_paid);
    const donePercent =
        outlookTotal > 0 ? Math.round((outlookDone * 100) / outlookTotal) : 0;
    const spendable = overview.accounts.filter((a) => !a.savings);
    const toPay = [
        ...upcoming.payments.map((item) => ({
            ...item,
            type: 'payment' as const,
        })),
        ...upcoming.installments.map((item) => ({
            ...item,
            type: 'installment' as const,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const hasExpectations =
        Number(end.expected_in) !== 0 || Number(end.expected_out) !== 0;
    const negative = Number(overview.available) < 0;
    const monthLabel = monthName(month.month, format.preferences.number_locale);

    const when = (date: string, overdue: boolean) => {
        if (overdue) {
            return `Pendiente desde el ${format.day(date)}`;
        }

        if (date === today) {
            return 'Hoy';
        }

        return format.day(date);
    };

    return (
        <>
            <Head title="Inicio" />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
                <header>
                    <p className="text-sm text-muted-foreground">
                        Hola, {firstName}
                    </p>
                    <h1 className="text-2xl font-semibold">Tu dinero</h1>
                </header>

                <PendingSyncNotice />

                {needsSetup && (
                    <Card className="border-primary/40 bg-primary/5">
                        <div className="flex items-start gap-3">
                            <Sparkles
                                className="mt-0.5 size-5 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <div className="flex-1">
                                <h2 className="font-semibold">
                                    Cuéntanos un poco de tu dinero
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Cuatro preguntas rápidas (cuánto tienes,
                                    cuánto cobras, qué pagas y si debes algo).
                                    Puedes saltarte las que quieras.
                                </p>
                                <Button asChild className="mt-3">
                                    <Link href={setupShow()}>Empezar</Link>
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* 1. ¿Cuánto dinero tengo ahora? */}
                <section className="rounded-3xl bg-linear-to-br from-hero-from to-hero-to p-6 text-white shadow-lg shadow-primary/20">
                    <h2 className="text-sm font-medium text-white/80">
                        Tienes para gastar
                    </h2>
                    <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                        {format.money(overview.available)}
                    </p>
                    {spendable.length > 1 && (
                        <p className="mt-2 text-sm text-white/80">
                            {spendable
                                .map(
                                    (a) =>
                                        `${a.name}: ${format.money(a.balance)}`,
                                )
                                .join(' · ')}
                        </p>
                    )}
                    {negative && (
                        <p className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm">
                            Estás en números rojos: has gastado más de lo que
                            tenías apuntado.
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => openQuick('savings')}
                        className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-white/15 p-3 text-left backdrop-blur hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    >
                        <PiggyBank
                            className="size-5 shrink-0"
                            aria-hidden="true"
                        />
                        <span className="flex-1 text-sm">
                            {overview.has_savings_account ? (
                                <>
                                    Ahorrado aparte:{' '}
                                    <span className="font-semibold tabular-nums">
                                        {format.money(overview.saved)}
                                    </span>
                                </>
                            ) : (
                                '¿Guardas dinero aparte? Crea tu hucha'
                            )}
                        </span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                </section>
                <QuickButtons />

                {notices.length > 0 && (
                    <ul className="grid gap-2" aria-label="Avisos">
                        {notices.map((notice) => (
                            <li
                                key={notice.text}
                                className={cn(
                                    'flex items-start gap-3 rounded-2xl p-3.5 text-sm font-medium',
                                    notice.tone === 'warning'
                                        ? 'bg-warning-soft text-warning'
                                        : 'bg-info-soft text-info',
                                )}
                            >
                                {notice.tone === 'warning' ? (
                                    <AlertCircle
                                        className="mt-0.5 size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Info
                                        className="mt-0.5 size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                )}
                                {notice.text}
                            </li>
                        ))}
                    </ul>
                )}

                {/* 2 y 3. Este mes. */}
                <Card>
                    <div className="flex items-baseline justify-between gap-2">
                        <h2 className="font-semibold first-letter:uppercase">
                            {monthLabel}
                        </h2>
                        <Link
                            href={monthsIndex()}
                            className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                            Ver mi mes
                        </Link>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-income-soft p-3">
                            <dt className="text-sm text-muted-foreground">
                                Te ha entrado
                            </dt>
                            <dd className="text-xl font-semibold text-income tabular-nums">
                                {format.money(month.received)}
                            </dd>
                        </div>
                        <div className="rounded-2xl bg-expense-soft p-3">
                            <dt className="text-sm text-muted-foreground">
                                Has gastado
                            </dt>
                            <dd className="text-xl font-semibold text-expense tabular-nums">
                                {format.money(month.spent)}
                            </dd>
                        </div>
                    </dl>
                    {Number(month.debt_paid) > 0 && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            Además, has pagado {format.money(month.debt_paid)}{' '}
                            en cuotas de deudas.
                        </p>
                    )}
                </Card>

                {/* Resumen de los gastos previstos hasta final de mes. */}
                <Card>
                    <h2 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
                        Gastos previstos de {monthLabel}
                    </h2>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-expense tabular-nums">
                        {format.money(outlook.total)}
                    </p>
                    <div
                        className="mt-3 flex h-3 overflow-hidden rounded-full bg-expense-soft"
                        role="img"
                        aria-label={`Llevas el ${donePercent} % gastado; el resto está pendiente de pagar.`}
                    >
                        <div
                            className="h-full rounded-full bg-expense"
                            style={{ width: `${donePercent}%` }}
                        />
                    </div>
                    <dl className="mt-3 grid gap-1.5 text-sm">
                        <div className="flex justify-between gap-3">
                            <dt className="flex items-center gap-2">
                                <span
                                    className="size-2.5 rounded-full bg-expense"
                                    aria-hidden="true"
                                />
                                Ya has gastado
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {format.money(outlook.spent)}
                            </dd>
                        </div>
                        {Number(outlook.debt_paid) > 0 && (
                            <div className="flex justify-between gap-3">
                                <dt className="flex items-center gap-2">
                                    <span
                                        className="size-2.5 rounded-full bg-expense"
                                        aria-hidden="true"
                                    />
                                    Cuotas ya pagadas
                                </dt>
                                <dd className="font-medium tabular-nums">
                                    {format.money(outlook.debt_paid)}
                                </dd>
                            </div>
                        )}
                        <div className="flex justify-between gap-3">
                            <dt className="flex items-center gap-2">
                                <span
                                    className="size-2.5 rounded-full bg-expense-soft ring-1 ring-expense/40"
                                    aria-hidden="true"
                                />
                                Pagos fijos que te quedan
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {format.money(outlook.pending_payments)}
                            </dd>
                        </div>
                        {Number(outlook.pending_installments) > 0 && (
                            <div className="flex justify-between gap-3">
                                <dt className="flex items-center gap-2">
                                    <span
                                        className="size-2.5 rounded-full bg-expense-soft ring-1 ring-expense/40"
                                        aria-hidden="true"
                                    />
                                    Cuotas que te quedan
                                </dt>
                                <dd className="font-medium tabular-nums">
                                    {format.money(outlook.pending_installments)}
                                </dd>
                            </div>
                        )}
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Es una previsión: lo pendiente aún no ha salido de tu
                        dinero. Lo que gastes a partir de hoy se irá sumando.
                    </p>
                </Card>

                {/* El mes que viene: todo lo que habrá que pagar. */}
                <NextMonthCard
                    next={overview.next_month}
                    locale={format.preferences.number_locale}
                />

                {/* 4. ¿Qué tengo que pagar próximamente? */}
                <Card>
                    <div className="flex items-baseline justify-between gap-2">
                        <h2 className="font-semibold">Te toca pagar pronto</h2>
                        <Link
                            href={paymentsIndex()}
                            className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                            Mis pagos
                        </Link>
                    </div>
                    {toPay.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                            No tienes pagos en los próximos 30 días.{' '}
                            <Link
                                href={paymentsIndex()}
                                className="text-primary underline-offset-4 hover:underline"
                            >
                                Apunta lo que pagas cada mes
                            </Link>{' '}
                            y te avisaremos.
                        </p>
                    ) : (
                        <ul className="mt-2 divide-y">
                            {toPay.slice(0, 5).map((item) => (
                                <li
                                    key={`${item.type}-${item.id}`}
                                    className="flex items-center gap-3 py-3"
                                >
                                    <CalendarClock
                                        className={cn(
                                            'size-5 shrink-0',
                                            item.overdue
                                                ? 'text-destructive'
                                                : 'text-muted-foreground',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">
                                            {item.concept}
                                        </p>
                                        <p
                                            className={cn(
                                                'text-xs first-letter:uppercase',
                                                item.overdue
                                                    ? 'text-destructive'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {when(item.date, item.overdue)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-semibold tabular-nums">
                                            {format.money(item.amount)}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8"
                                            onClick={() =>
                                                item.type === 'payment'
                                                    ? setPaying(item)
                                                    : setInstallment(item)
                                            }
                                        >
                                            {item.type === 'payment'
                                                ? 'Ya lo pagué'
                                                : 'Pagué la cuota'}
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {upcoming.incomes.length > 0 && (
                        <>
                            <h3 className="mt-4 text-sm font-medium text-muted-foreground">
                                Esperas cobrar
                            </h3>
                            <ul className="divide-y">
                                {upcoming.incomes.slice(0, 3).map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <HandCoins
                                            className="size-5 shrink-0 text-primary"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium">
                                                {item.concept}
                                            </p>
                                            <p className="text-xs text-muted-foreground first-letter:uppercase">
                                                {when(item.date, item.overdue)}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-semibold text-income tabular-nums">
                                                + {format.money(item.amount)}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8"
                                                onClick={() =>
                                                    setCollecting(item)
                                                }
                                            >
                                                Ya lo cobré
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </Card>

                {/* 5. ¿Cuánto debo todavía? */}
                {debts.count > 0 && (
                    <Card>
                        <Link
                            href={paymentsIndex({ query: { ver: 'deudas' } })}
                            className="flex items-center gap-3"
                        >
                            <div className="flex-1">
                                <h2 className="text-sm font-medium text-muted-foreground">
                                    Te falta por pagar de tus deudas
                                </h2>
                                <p className="text-2xl font-semibold tabular-nums">
                                    {format.money(debts.owed)}
                                </p>
                            </div>
                            <ArrowRight
                                className="size-5 text-muted-foreground"
                                aria-hidden="true"
                            />
                        </Link>
                    </Card>
                )}

                {hasExpectations && (
                    <Card className="border-savings/30 bg-savings-soft">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            Si todo va como esperas, a final de mes te quedarían
                        </h2>
                        <p className="text-2xl font-semibold tabular-nums">
                            {format.money(end.estimate)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Es una estimación, no dinero que tengas ya: suma lo
                            que esperas cobrar ({format.money(end.expected_in)})
                            y resta lo que te queda por pagar este mes (
                            {format.money(end.expected_out)}).
                        </p>
                    </Card>
                )}

                {mascot && <MascotCompanion mascot={mascot} />}
            </div>

            <ConfirmPendingSheet
                item={paying}
                kind="expense"
                accounts={overview.accounts}
                today={today}
                onClose={() => setPaying(null)}
            />
            <ConfirmPendingSheet
                item={collecting}
                kind="income"
                accounts={overview.accounts}
                today={today}
                onClose={() => setCollecting(null)}
            />
            <DebtPaymentSheet
                item={installment}
                accounts={overview.accounts}
                today={today}
                interestCategoryId={interestCategoryId}
                onClose={() => setInstallment(null)}
            />
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Inicio', href: dashboard() }],
};
