import { Head } from '@inertiajs/react';
import {
    CalendarClock,
    CircleCheck,
    HandCoins,
    MoreHorizontal,
    Pause,
    Pencil,
    Play,
    Plus,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import RecurringRuleController from '@/actions/App/Http/Controllers/Finance/RecurringRuleController';
import TransactionController from '@/actions/App/Http/Controllers/Finance/TransactionController';
import { CategoryIcon } from '@/components/finance/category-badge';
import { RuleForm } from '@/components/finance/rule-form';
import type { RuleData } from '@/components/finance/rule-form';
import { DebtForm } from '@/components/payments/debt-form';
import type { DebtData } from '@/components/payments/debt-form';
import {
    ConfirmPendingSheet,
    DebtPaymentSheet,
} from '@/components/payments/pay-sheets';
import type {
    InstallmentItem,
    PendingItem,
} from '@/components/payments/pay-sheets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useFormat } from '@/hooks/use-format';
import { quickAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { index as paymentsIndex } from '@/routes/payments';
import type { AccountOption, CategoryOption } from '@/types/finance';

type Pending = PendingItem & {
    category: { name: string; icon: string; color: string } | null;
};

type Rule = RuleData & {
    frequency_label: string;
    next_on: string | null;
    paused: boolean;
};

type Debt = DebtData & {
    paid: string;
    outstanding: string;
    percent: number;
    next_installment: string | null;
    installments_left: number | null;
    frequency_label: string | null;
    ends_on: string | null;
    settled: boolean;
};

type Props = {
    upcoming: {
        payments: Pending[];
        incomes: Pending[];
        installments: InstallmentItem[];
    };
    rules: Rule[];
    debts: Debt[];
    owed: string;
    accounts: (AccountOption & { savings: boolean })[];
    categories: CategoryOption[];
    interestCategoryId: number | null;
    frequencies: { value: string; label: string }[];
    today: string;
};

type Tab = 'pagar' | 'habituales' | 'deudas';

type Sheet =
    | { type: 'rule'; kind: 'income' | 'expense'; rule: Rule | null }
    | { type: 'debt'; debt: Debt | null }
    | { type: 'delete-rule'; rule: Rule }
    | { type: 'skip'; item: Pending }
    | null;

function Section({
    title,
    description,
    action,
    children,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            {children}
        </p>
    );
}

export default function Payments(props: Props) {
    const { upcoming, rules, debts, owed, accounts, today } = props;
    const format = useFormat();
    const initialTab: Tab =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('ver') === 'deudas'
            ? 'deudas'
            : 'pagar';
    const [tab, setTab] = useState<Tab>(initialTab);
    const [sheet, setSheet] = useState<Sheet>(null);
    const [paying, setPaying] = useState<PendingItem | null>(null);
    const [collecting, setCollecting] = useState<PendingItem | null>(null);
    const [installment, setInstallment] = useState<InstallmentItem | null>(
        null,
    );

    const toPay = [
        ...upcoming.payments.map((item) => ({
            ...item,
            type: 'payment' as const,
        })),
        ...upcoming.installments.map((item) => ({
            ...item,
            type: 'installment' as const,
            category: null,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const expenseRules = rules.filter((rule) => rule.kind === 'expense');
    const incomeRules = rules.filter((rule) => rule.kind === 'income');
    const activeDebts = debts.filter((debt) => !debt.settled);
    const finishedDebts = debts.filter((debt) => debt.settled);

    const tabs: [Tab, string][] = [
        ['pagar', 'Por pagar'],
        ['habituales', 'Cada mes'],
        ['deudas', 'Lo que debo'],
    ];

    const date = (value: string, overdue: boolean) =>
        overdue
            ? `Pendiente desde el ${format.day(value)}`
            : value === today
              ? 'Hoy'
              : format.day(value);

    const ruleRow = (rule: Rule) => (
        <li
            key={rule.id}
            className={cn(
                'flex items-center gap-3 p-4',
                rule.paused && 'opacity-60',
            )}
        >
            <CategoryIcon
                icon={rule.category.icon}
                color={rule.category.color}
            />
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{rule.concept}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {rule.frequency_label}
                    {rule.next_on &&
                        ` · el próximo, ${format.day(rule.next_on)}`}
                    {rule.nature === 'variable' && ' · importe variable'}
                </p>
            </div>
            <div className="text-right">
                <p className="font-semibold tabular-nums">
                    {rule.nature === 'variable' && '≈ '}
                    {format.money(rule.amount)}
                </p>
                {rule.paused && <Badge variant="outline">En pausa</Badge>}
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Opciones de ${rule.concept}`}
                    >
                        <MoreHorizontal aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onSelect={() =>
                            setSheet({ type: 'rule', kind: rule.kind, rule })
                        }
                    >
                        <Pencil aria-hidden="true" />
                        Cambiar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() =>
                            quickAction(
                                rule.paused
                                    ? RecurringRuleController.resume.url(
                                          rule.id,
                                      )
                                    : RecurringRuleController.pause.url(
                                          rule.id,
                                      ),
                            )
                        }
                    >
                        {rule.paused ? (
                            <Play aria-hidden="true" />
                        ) : (
                            <Pause aria-hidden="true" />
                        )}
                        {rule.paused ? 'Reanudar' : 'Pausar un tiempo'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setSheet({ type: 'delete-rule', rule })}
                    >
                        <Trash2 aria-hidden="true" />
                        Ya no lo pago
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );

    return (
        <>
            <Head title="Mis pagos" />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <header>
                    <h1 className="text-2xl font-semibold">Mis pagos</h1>
                    <p className="text-sm text-muted-foreground">
                        Lo que te toca pagar, lo de cada mes y lo que debes.
                    </p>
                </header>

                <div
                    role="tablist"
                    aria-label="Secciones de mis pagos"
                    className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
                >
                    {tabs.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => setTab(key)}
                            className={cn(
                                'min-h-10 rounded-lg px-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                tab === key
                                    ? 'bg-background shadow-xs'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'pagar' && (
                    <>
                        <Section
                            title="¿Cuándo te toca pagar?"
                            description="Los próximos 30 días. Nada se descuenta hasta que pulses «Ya lo pagué»."
                        >
                            {toPay.length === 0 ? (
                                <Empty>
                                    No tienes pagos pendientes. Apunta en «Cada
                                    mes» lo que pagas habitualmente.
                                </Empty>
                            ) : (
                                <ul className="divide-y rounded-2xl border bg-card">
                                    {toPay.map((item) => (
                                        <li
                                            key={`${item.type}-${item.id}`}
                                            className="flex items-center gap-3 p-4"
                                        >
                                            {item.category ? (
                                                <CategoryIcon
                                                    icon={item.category.icon}
                                                    color={item.category.color}
                                                />
                                            ) : (
                                                <span
                                                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary"
                                                    aria-hidden="true"
                                                >
                                                    <HandCoins className="size-4.5" />
                                                </span>
                                            )}
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
                                                    {date(
                                                        item.date,
                                                        item.overdue,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className="font-semibold tabular-nums">
                                                    {format.money(item.amount)}
                                                </span>
                                                <div className="flex gap-1">
                                                    {item.type ===
                                                        'payment' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 px-2 text-xs"
                                                            onClick={() =>
                                                                setSheet({
                                                                    type: 'skip',
                                                                    item,
                                                                })
                                                            }
                                                        >
                                                            Este no
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() =>
                                                            item.type ===
                                                            'payment'
                                                                ? setPaying(
                                                                      item,
                                                                  )
                                                                : setInstallment(
                                                                      item,
                                                                  )
                                                        }
                                                    >
                                                        <CircleCheck aria-hidden="true" />
                                                        {item.type === 'payment'
                                                            ? 'Ya lo pagué'
                                                            : 'Pagué la cuota'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>

                        {upcoming.incomes.length > 0 && (
                            <Section
                                title="Lo que esperas cobrar"
                                description="No suma a tu dinero hasta que confirmes que ha llegado."
                            >
                                <ul className="divide-y rounded-2xl border bg-card">
                                    {upcoming.incomes.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex items-center gap-3 p-4"
                                        >
                                            <CalendarClock
                                                className="size-5 shrink-0 text-primary"
                                                aria-hidden="true"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">
                                                    {item.concept}
                                                </p>
                                                <p className="text-xs text-muted-foreground first-letter:uppercase">
                                                    {date(
                                                        item.date,
                                                        item.overdue,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className="font-semibold text-income tabular-nums">
                                                    +{' '}
                                                    {format.money(item.amount)}
                                                </span>
                                                <Button
                                                    size="sm"
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
                            </Section>
                        )}
                    </>
                )}

                {tab === 'habituales' && (
                    <>
                        <Section
                            title="¿Qué pagas todos los meses?"
                            description="El alquiler, la luz, el móvil, las suscripciones…"
                            action={
                                <Button
                                    onClick={() =>
                                        setSheet({
                                            type: 'rule',
                                            kind: 'expense',
                                            rule: null,
                                        })
                                    }
                                >
                                    <Plus aria-hidden="true" />
                                    Añadir un pago
                                </Button>
                            }
                        >
                            {expenseRules.length === 0 ? (
                                <Empty>
                                    Aún no has apuntado ningún pago habitual.
                                </Empty>
                            ) : (
                                <ul className="divide-y rounded-2xl border bg-card">
                                    {expenseRules.map(ruleRow)}
                                </ul>
                            )}
                        </Section>

                        <Section
                            title="¿Cuánto cobras?"
                            description="Tu sueldo u otros ingresos que se repiten."
                            action={
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        setSheet({
                                            type: 'rule',
                                            kind: 'income',
                                            rule: null,
                                        })
                                    }
                                >
                                    <Plus aria-hidden="true" />
                                    Añadir un cobro
                                </Button>
                            }
                        >
                            {incomeRules.length === 0 ? (
                                <Empty>
                                    Si cobras un sueldo, apúntalo y te
                                    recordaremos cuándo llega.
                                </Empty>
                            ) : (
                                <ul className="divide-y rounded-2xl border bg-card">
                                    {incomeRules.map(ruleRow)}
                                </ul>
                            )}
                        </Section>
                    </>
                )}

                {tab === 'deudas' && (
                    <Section
                        title="Lo que debo"
                        description={
                            activeDebts.length > 0
                                ? `En total te falta por pagar ${format.money(owed)}.`
                                : undefined
                        }
                        action={
                            <Button
                                onClick={() =>
                                    setSheet({ type: 'debt', debt: null })
                                }
                            >
                                <Plus aria-hidden="true" />
                                Apuntar una deuda
                            </Button>
                        }
                    >
                        {debts.length === 0 ? (
                            <Empty>
                                ¿Debes dinero? Un préstamo, algo a plazos o
                                dinero de un amigo: apúntalo y verás cuánto te
                                falta.
                            </Empty>
                        ) : (
                            <ul className="grid gap-3">
                                {[...activeDebts, ...finishedDebts].map(
                                    (debt) => (
                                        <li
                                            key={debt.id}
                                            className={cn(
                                                'rounded-2xl border bg-card p-5',
                                                debt.settled && 'opacity-70',
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-lg font-semibold">
                                                        {debt.concept}
                                                    </h3>
                                                    {debt.creditor && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Con {debt.creditor}
                                                        </p>
                                                    )}
                                                </div>
                                                {debt.settled ? (
                                                    <Badge>¡Terminada!</Badge>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Cambiar ${debt.concept}`}
                                                        onClick={() =>
                                                            setSheet({
                                                                type: 'debt',
                                                                debt,
                                                            })
                                                        }
                                                    >
                                                        <Pencil aria-hidden="true" />
                                                    </Button>
                                                )}
                                            </div>

                                            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Debías
                                                    </dt>
                                                    <dd className="font-medium tabular-nums">
                                                        {format.money(
                                                            debt.principal,
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Has pagado
                                                    </dt>
                                                    <dd className="font-medium tabular-nums">
                                                        {format.money(
                                                            debt.paid,
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Te falta
                                                    </dt>
                                                    <dd className="font-semibold tabular-nums">
                                                        {format.money(
                                                            debt.outstanding,
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>

                                            <ProgressBar
                                                value={debt.percent}
                                                className="mt-3"
                                                label={`${debt.percent} % pagado`}
                                            />

                                            {!debt.settled && (
                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                                    <p className="text-sm text-muted-foreground">
                                                        {debt.next_due_on &&
                                                        debt.next_installment
                                                            ? `Próxima cuota: ${format.money(debt.next_installment)}, ${format.day(debt.next_due_on)}.`
                                                            : 'Sin fecha de próxima cuota.'}
                                                        {debt.installments_left !==
                                                            null &&
                                                            ` Te quedan ${debt.installments_left} ${debt.installments_left === 1 ? 'cuota' : 'cuotas'}`}
                                                        {debt.ends_on &&
                                                            ` (terminas hacia ${format.day(debt.ends_on)}).`}
                                                    </p>
                                                    <Button
                                                        onClick={() =>
                                                            setInstallment({
                                                                id: debt.id,
                                                                concept:
                                                                    debt.concept,
                                                                amount:
                                                                    debt.next_installment ??
                                                                    debt.outstanding,
                                                                date:
                                                                    debt.next_due_on ??
                                                                    today,
                                                                overdue: false,
                                                            })
                                                        }
                                                    >
                                                        Pagué una cuota
                                                    </Button>
                                                </div>
                                            )}
                                        </li>
                                    ),
                                )}
                            </ul>
                        )}
                    </Section>
                )}
            </div>

            <Dialog
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
            >
                <DialogContent>
                    {sheet?.type === 'rule' && (
                        <RuleForm
                            kind={sheet.kind}
                            rule={sheet.rule}
                            accounts={accounts.filter((a) => !a.savings)}
                            categories={props.categories}
                            frequencies={props.frequencies}
                            today={today}
                            onDone={() => setSheet(null)}
                        />
                    )}
                    {sheet?.type === 'debt' && (
                        <DebtForm
                            debt={sheet.debt}
                            today={today}
                            onDone={() => setSheet(null)}
                        />
                    )}
                    {sheet?.type === 'delete-rule' && (
                        <>
                            <DialogTitle>
                                ¿Ya no pagas «{sheet.rule.concept}»?
                            </DialogTitle>
                            <DialogDescription>
                                Dejará de aparecer en tus próximos pagos. Lo que
                                ya pagaste se queda en tu historial. Si solo es
                                por un tiempo, mejor ponlo en pausa.
                            </DialogDescription>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        quickAction(
                                            RecurringRuleController.destroy.url(
                                                sheet.rule.id,
                                            ),
                                            'delete',
                                        );
                                        setSheet(null);
                                    }}
                                >
                                    Quitarlo
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                    {sheet?.type === 'skip' && (
                        <>
                            <DialogTitle>
                                ¿Este mes no pagas «{sheet.item.concept}»?
                            </DialogTitle>
                            <DialogDescription>
                                Quitaremos solo el del{' '}
                                {format.day(sheet.item.date)}. Los siguientes
                                seguirán apareciendo.
                            </DialogDescription>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button
                                    onClick={() => {
                                        quickAction(
                                            TransactionController.destroy.url(
                                                sheet.item.id,
                                            ),
                                            'delete',
                                        );
                                        setSheet(null);
                                    }}
                                >
                                    Quitar este pago
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmPendingSheet
                item={paying}
                kind="expense"
                accounts={accounts}
                today={today}
                onClose={() => setPaying(null)}
            />
            <ConfirmPendingSheet
                item={collecting}
                kind="income"
                accounts={accounts}
                today={today}
                onClose={() => setCollecting(null)}
            />
            <DebtPaymentSheet
                item={installment}
                accounts={accounts}
                today={today}
                interestCategoryId={props.interestCategoryId}
                onClose={() => setInstallment(null)}
            />
        </>
    );
}

Payments.layout = {
    breadcrumbs: [{ title: 'Mis pagos', href: paymentsIndex() }],
};
