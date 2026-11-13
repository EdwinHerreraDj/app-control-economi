import { Head } from '@inertiajs/react';
import {
    CalendarClock,
    CircleCheck,
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
import { fromMinor, toMinor } from '@/offline/money';
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

type Tab = 'gastos' | 'ingresos' | 'deudas';

type Sheet =
    | {
          type: 'rule';
          kind: 'income' | 'expense';
          rule: Rule | null;
          categoryId: number | null;
      }
    | { type: 'debt'; debt: Debt | null }
    | { type: 'delete-rule'; rule: Rule }
    | { type: 'skip'; item: Pending }
    | null;

/** Veces al mes de cada frecuencia (numerador, denominador). */
const PER_MONTH: Record<string, [number, number]> = {
    weekly: [52, 12],
    biweekly: [26, 12],
    monthly: [1, 1],
    bimonthly: [1, 2],
    quarterly: [1, 3],
    semiannual: [1, 6],
    yearly: [1, 12],
};

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
    const decimals = format.preferences.currency_decimals ?? 2;
    const initialTab: Tab =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('ver') === 'deudas'
            ? 'deudas'
            : 'gastos';
    const [tab, setTab] = useState<Tab>(initialTab);
    const [sheet, setSheet] = useState<Sheet>(null);
    const [paying, setPaying] = useState<PendingItem | null>(null);
    const [collecting, setCollecting] = useState<PendingItem | null>(null);
    const [installment, setInstallment] = useState<InstallmentItem | null>(
        null,
    );

    const activeDebts = debts.filter((debt) => !debt.settled);
    const finishedDebts = debts.filter((debt) => debt.settled);

    const date = (value: string, overdue: boolean) =>
        overdue
            ? `Pendiente desde el ${format.day(value)}`
            : value === today
              ? 'Hoy'
              : format.day(value);

    // Lo que suponen al mes (una semana son 52/12 veces al mes…).
    const perMonth = (list: Rule[]) =>
        fromMinor(
            list
                .filter((rule) => !rule.paused)
                .reduce((sum, rule) => {
                    const [num, den] = PER_MONTH[rule.frequency] ?? [1, 1];

                    return (
                        sum +
                        Math.round((toMinor(rule.amount, decimals) * num) / den)
                    );
                }, 0),
            decimals,
        );

    const tabs: [Tab, string][] = [
        ['gastos', 'Gastos fijos'],
        ['ingresos', 'Ingresos fijos'],
        ['deudas', 'Lo que debo'],
    ];

    /** Gastos fijos o ingresos fijos: misma estructura, distinto color. */
    const recurring = (kind: 'expense' | 'income') => {
        const isExpense = kind === 'expense';
        const list = rules.filter((rule) => rule.kind === kind);
        const pending = isExpense ? upcoming.payments : upcoming.incomes;
        const tone = isExpense ? 'text-expense' : 'text-income';
        const categories = props.categories.filter(
            (c) => c.kind === kind && !c.archived,
        );

        return (
            <>
                <section
                    className={cn(
                        'rounded-3xl p-5',
                        isExpense ? 'bg-expense-soft' : 'bg-income-soft',
                    )}
                >
                    <h2 className="text-lg font-semibold">
                        {isExpense
                            ? 'Lo que pagas mes a mes'
                            : 'Lo que recibes mes a mes'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isExpense
                            ? 'El alquiler, la luz, internet, el gimnasio… Apúntalos una vez y te avisaremos cuando toque. Nada se descuenta hasta que pulses «Ya lo pagué».'
                            : 'Tu nómina, tu negocio, un servicio que cobras, una pensión… lo que te entra cada mes, más o menos en la misma fecha. No se suma a tu dinero hasta que confirmes que ha llegado.'}
                    </p>
                    {list.length > 0 && (
                        <p className="mt-3 text-sm">
                            {isExpense
                                ? 'Al mes pagas unos '
                                : 'Al mes recibes unos '}
                            <span
                                className={cn(
                                    'text-2xl font-semibold tabular-nums',
                                    tone,
                                )}
                            >
                                {format.money(perMonth(list) as `${number}`)}
                            </span>
                        </p>
                    )}
                </section>

                {pending.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="font-semibold">
                            {isExpense ? 'Te toca pagar' : 'Te toca cobrar'}
                        </h2>
                        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                            {pending.map((item) => (
                                <li key={item.id} className="grid gap-3 p-4">
                                    <div className="flex items-center gap-3">
                                        <CalendarClock
                                            className={cn(
                                                'size-5 shrink-0',
                                                item.overdue
                                                    ? 'text-warning'
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
                                                        ? 'font-medium text-warning'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {date(item.date, item.overdue)}
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                'shrink-0 font-semibold tabular-nums',
                                                tone,
                                            )}
                                        >
                                            {format.money(item.amount)}
                                        </span>
                                    </div>
                                    {/* Botones debajo: el nombre tiene todo el ancho. */}
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-9"
                                            onClick={() =>
                                                setSheet({
                                                    type: 'skip',
                                                    item,
                                                })
                                            }
                                        >
                                            Este no
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-9"
                                            onClick={() =>
                                                isExpense
                                                    ? setPaying(item)
                                                    : setCollecting(item)
                                            }
                                        >
                                            <CircleCheck aria-hidden="true" />
                                            {isExpense
                                                ? 'Ya lo pagué'
                                                : 'Ya lo cobré'}
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <section className="space-y-3">
                    <h2 className="font-semibold">
                        {isExpense
                            ? '¿Qué pagas todos los meses? Toca para añadirlo'
                            : '¿Qué cobras todos los meses? Toca para añadirlo'}
                    </h2>
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                        {categories.map((category) => (
                            <li key={category.id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSheet({
                                            type: 'rule',
                                            kind,
                                            rule: null,
                                            categoryId: category.id,
                                        })
                                    }
                                    className="flex h-full min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 text-center shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]"
                                >
                                    <CategoryIcon
                                        icon={category.icon}
                                        color={category.color}
                                    />
                                    <span className="line-clamp-2 text-xs leading-tight font-medium">
                                        {category.name}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="font-semibold">
                        {isExpense ? 'Tus gastos fijos' : 'Tus ingresos fijos'}
                    </h2>
                    {list.length === 0 ? (
                        <Empty>
                            {isExpense
                                ? 'Aún no has apuntado ningún gasto fijo.'
                                : 'Si cobras una nómina, apúntala y te recordaremos cuándo llega.'}
                        </Empty>
                    ) : (
                        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                            {list.map((rule) => (
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
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={() =>
                                            setSheet({
                                                type: 'rule',
                                                kind,
                                                rule,
                                                categoryId: null,
                                            })
                                        }
                                    >
                                        <span className="block truncate font-medium">
                                            {rule.concept}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {rule.frequency_label}
                                            {rule.next_on &&
                                                ` · el próximo, ${format.day(rule.next_on)}`}
                                        </span>
                                    </button>
                                    <div className="text-right">
                                        <p
                                            className={cn(
                                                'font-semibold tabular-nums',
                                                tone,
                                            )}
                                        >
                                            {rule.nature === 'variable' && '≈ '}
                                            {format.money(rule.amount)}
                                        </p>
                                        {rule.paused && (
                                            <Badge variant="outline">
                                                En pausa
                                            </Badge>
                                        )}
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
                                                    setSheet({
                                                        type: 'rule',
                                                        kind,
                                                        rule,
                                                        categoryId: null,
                                                    })
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
                                                {rule.paused
                                                    ? 'Reanudar'
                                                    : 'Pausar un tiempo'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onSelect={() =>
                                                    setSheet({
                                                        type: 'delete-rule',
                                                        rule,
                                                    })
                                                }
                                            >
                                                <Trash2 aria-hidden="true" />
                                                {isExpense
                                                    ? 'Ya no lo pago'
                                                    : 'Ya no lo cobro'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </>
        );
    };

    return (
        <>
            <Head title="Mis pagos" />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <header>
                    <h1 className="text-2xl font-semibold">Mis pagos</h1>
                    <p className="text-sm text-muted-foreground">
                        Lo que se repite cada mes y lo que debes.
                    </p>
                </header>

                <div
                    role="tablist"
                    aria-label="Secciones de mis pagos"
                    className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1"
                >
                    {tabs.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => setTab(key)}
                            className={cn(
                                'min-h-11 rounded-xl px-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                tab === key
                                    ? 'bg-background shadow-xs'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'gastos' && recurring('expense')}
                {tab === 'ingresos' && recurring('income')}

                {tab === 'deudas' && (
                    <>
                        <section className="rounded-3xl bg-savings-soft p-5">
                            <h2 className="text-lg font-semibold">
                                Lo que debo
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Un préstamo, algo comprado a plazos o dinero que
                                te dejaron. Apuntarla no cuenta como gasto: solo
                                cuentan los pagos que hagas.
                            </p>
                            {activeDebts.length > 0 && (
                                <p className="mt-3 text-sm">
                                    En total te falta por pagar{' '}
                                    <span className="text-2xl font-semibold text-savings tabular-nums">
                                        {format.money(owed)}
                                    </span>
                                </p>
                            )}
                            <Button
                                className="mt-4"
                                onClick={() =>
                                    setSheet({ type: 'debt', debt: null })
                                }
                            >
                                <Plus aria-hidden="true" />
                                Apuntar una deuda
                            </Button>
                        </section>

                        {debts.length === 0 ? (
                            <Empty>No tienes deudas apuntadas.</Empty>
                        ) : (
                            <ul className="grid gap-3">
                                {[...activeDebts, ...finishedDebts].map(
                                    (debt) => (
                                        <li
                                            key={debt.id}
                                            className={cn(
                                                'rounded-2xl border bg-card p-5 shadow-xs',
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
                                                    <Badge className="bg-income-soft text-income">
                                                        ¡Terminada!
                                                    </Badge>
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
                                                    <dd className="font-medium text-income tabular-nums">
                                                        {format.money(
                                                            debt.paid,
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-muted-foreground">
                                                        Te falta
                                                    </dt>
                                                    <dd className="font-semibold text-expense tabular-nums">
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
                    </>
                )}
            </div>

            <Dialog
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
            >
                <DialogContent
                    // El foco va al panel: si fuera a la primera casilla,
                    // parecería elegida.
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        (event.currentTarget as HTMLElement).focus();
                    }}
                >
                    {sheet?.type === 'rule' && (
                        <RuleForm
                            kind={sheet.kind}
                            rule={sheet.rule}
                            presetCategoryId={sheet.categoryId}
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
                                ¿Quitar «{sheet.rule.concept}»?
                            </DialogTitle>
                            <DialogDescription>
                                Dejará de aparecer cada mes. Lo que ya marcaste
                                como hecho se queda en tu historial. Si solo es
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
                                ¿Esta vez no toca «{sheet.item.concept}»?
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
                                    Quitar solo este
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
