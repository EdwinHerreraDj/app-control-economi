import { Head, Link, setLayoutProps } from '@inertiajs/react';
import {
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Plus,
    Repeat,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import TransactionController from '@/actions/App/Http/Controllers/Finance/TransactionController';
import { CategoryIcon } from '@/components/finance/category-badge';
import { TransactionForm } from '@/components/finance/movement-forms';
import { openQuick } from '@/components/quick/quick-store';
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
import { useFormat } from '@/hooks/use-format';
import { quickAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { index as categoriesIndex } from '@/routes/categories';
import { index as expensesIndex } from '@/routes/expenses';
import { index as incomesIndex } from '@/routes/incomes';
import type { AccountOption, CategoryOption, Movement } from '@/types/finance';

type FlowMovement = Movement & {
    recurring: boolean;
    spending_type: string | null;
};

type Group = {
    id: number;
    name: string;
    icon: string;
    color: string;
    archived: boolean;
    total: string;
    pending: string;
    count: number;
    movements: FlowMovement[];
};

type Props = {
    kind: 'expense' | 'income';
    month: string;
    previous: string;
    next: string | null;
    isCurrent: boolean;
    total: string;
    pending: string;
    groups: Group[];
    accounts: AccountOption[];
    categories: CategoryOption[];
    today: string;
};

type Sheet =
    | { type: 'edit'; movement: FlowMovement }
    | { type: 'delete'; movement: FlowMovement }
    | null;

function monthTitle(month: string, locale: string): string {
    const [year, number] = month.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, number - 1, 1)));
}

function shortDay(date: string, locale: string): string {
    const [y, m, d] = date.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default function Flows(props: Props) {
    const { kind, month, previous, next, isCurrent, groups } = props;
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const [sheet, setSheet] = useState<Sheet>(null);
    const isExpense = kind === 'expense';
    const route = isExpense ? expensesIndex : incomesIndex;
    const used = groups.filter((group) => group.count > 0);
    const sign = isExpense ? '−' : '+';
    const tone = isExpense ? 'text-expense' : 'text-income';

    // Lo ya ocurrido en su color; si solo hay pendientes, se ve en ámbar.
    const groupAmount = (group: Group) =>
        Number(group.total) > 0
            ? { text: format.money(group.total), className: tone }
            : {
                  text: `Pendiente ${format.money(group.pending)}`,
                  className: 'text-warning',
              };

    // La misma página sirve para gastos e ingresos: la miga de pan se ajusta.
    useEffect(() => {
        setLayoutProps({
            breadcrumbs: [
                {
                    title: isExpense ? 'Gastos' : 'Ingresos',
                    href: isExpense ? expensesIndex() : incomesIndex(),
                },
            ],
        });
    }, [isExpense]);

    return (
        <>
            <Head title={isExpense ? 'Gastos' : 'Ingresos'} />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
                <header className="flex items-center justify-between gap-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link
                            href={route({ query: { month: previous } })}
                            aria-label="Mes anterior"
                            preserveScroll
                        >
                            <ChevronLeft aria-hidden="true" />
                        </Link>
                    </Button>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold">
                            {isExpense ? 'Gastos' : 'Ingresos'}
                        </h1>
                        <p className="text-sm text-muted-foreground first-letter:uppercase">
                            {monthTitle(month, locale)}
                        </p>
                    </div>
                    {next ? (
                        <Button variant="ghost" size="icon" asChild>
                            <Link
                                href={route({ query: { month: next } })}
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

                <section
                    className={cn(
                        'rounded-3xl p-5',
                        isExpense ? 'bg-expense-soft' : 'bg-income-soft',
                    )}
                >
                    <p className="text-sm font-medium text-muted-foreground">
                        {isExpense
                            ? isCurrent
                                ? 'Este mes llevas gastado'
                                : 'Ese mes gastaste'
                            : isCurrent
                              ? 'Este mes te ha entrado'
                              : 'Ese mes te entró'}
                    </p>
                    <p
                        className={cn(
                            'text-4xl font-semibold tracking-tight tabular-nums',
                            tone,
                        )}
                    >
                        {format.money(props.total)}
                    </p>
                    {Number(props.pending) > 0 && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-warning">
                            <CalendarClock
                                className="size-4"
                                aria-hidden="true"
                            />
                            {isExpense
                                ? `Y ${format.money(props.pending)} pendientes de pagar`
                                : `Y ${format.money(props.pending)} pendientes de cobrar`}
                        </p>
                    )}
                </section>

                <section className="space-y-3" aria-labelledby="tiles-title">
                    <h2 id="tiles-title" className="font-semibold">
                        {isExpense
                            ? 'Toca en qué gastaste para apuntarlo'
                            : 'Toca de dónde te entró para apuntarlo'}
                    </h2>
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                        {groups
                            .filter((group) => !group.archived)
                            .map((group) => (
                                <li key={group.id}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openQuick(kind, group.id)
                                        }
                                        className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 text-center shadow-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]"
                                    >
                                        <CategoryIcon
                                            icon={group.icon}
                                            color={group.color}
                                        />
                                        <span className="line-clamp-2 text-xs leading-tight font-medium">
                                            {group.name}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-xs tabular-nums',
                                                group.count > 0
                                                    ? cn(
                                                          'font-semibold',
                                                          groupAmount(group)
                                                              .className,
                                                      )
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {group.count > 0
                                                ? groupAmount(group).text
                                                : 'Apuntar'}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        <li>
                            <Link
                                href={categoriesIndex()}
                                className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <Plus className="size-5" aria-hidden="true" />
                                Nueva categoría
                            </Link>
                        </li>
                    </ul>
                </section>

                <section className="space-y-3" aria-labelledby="groups-title">
                    <h2 id="groups-title" className="font-semibold">
                        {isExpense ? 'En qué se ha ido' : 'De dónde ha venido'}
                    </h2>

                    {used.length === 0 ? (
                        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            {isExpense
                                ? 'Aún no has apuntado gastos este mes.'
                                : 'Aún no has apuntado ingresos este mes.'}
                        </p>
                    ) : (
                        used.map((group) => (
                            <article
                                key={group.id}
                                className="overflow-hidden rounded-2xl border bg-card shadow-xs"
                            >
                                <header className="flex items-center gap-3 border-b bg-muted/40 p-4">
                                    <CategoryIcon
                                        icon={group.icon}
                                        color={group.color}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate font-semibold">
                                            {group.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {group.count === 1
                                                ? '1 movimiento'
                                                : `${group.count} movimientos`}
                                        </p>
                                    </div>
                                    <p
                                        className={cn(
                                            'text-right text-lg font-semibold tabular-nums',
                                            groupAmount(group).className,
                                        )}
                                    >
                                        {groupAmount(group).text}
                                    </p>
                                </header>
                                <ul className="divide-y">
                                    {group.movements.map((movement) => {
                                        const pending =
                                            movement.status === 'planned';

                                        return (
                                            <li
                                                key={movement.id}
                                                className="flex items-center gap-2 py-1 pr-2 pl-4"
                                            >
                                                <button
                                                    type="button"
                                                    disabled={
                                                        movement.debt_managed
                                                    }
                                                    onClick={() =>
                                                        setSheet({
                                                            type: 'edit',
                                                            movement,
                                                        })
                                                    }
                                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left disabled:cursor-default"
                                                >
                                                    <span className="w-12 shrink-0 text-xs text-muted-foreground">
                                                        {shortDay(
                                                            movement.occurred_on,
                                                            locale,
                                                        )}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium">
                                                            {movement.concept}
                                                        </span>
                                                        <span className="flex flex-wrap gap-1">
                                                            {pending && (
                                                                <Badge className="bg-warning-soft text-warning">
                                                                    Pendiente
                                                                </Badge>
                                                            )}
                                                            {movement.recurring && (
                                                                <Badge variant="outline">
                                                                    <Repeat aria-hidden="true" />
                                                                    Habitual
                                                                </Badge>
                                                            )}
                                                            {movement.spending_type ===
                                                                'treat' && (
                                                                <Badge variant="outline">
                                                                    Un gusto
                                                                </Badge>
                                                            )}
                                                        </span>
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'shrink-0 text-sm font-semibold tabular-nums',
                                                            pending
                                                                ? 'text-muted-foreground'
                                                                : tone,
                                                        )}
                                                    >
                                                        {sign}{' '}
                                                        {format.money(
                                                            movement.amount,
                                                        )}
                                                    </span>
                                                </button>
                                                {!movement.debt_managed && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-9 shrink-0 text-muted-foreground"
                                                        aria-label={`Borrar ${movement.concept}`}
                                                        onClick={() =>
                                                            setSheet({
                                                                type: 'delete',
                                                                movement,
                                                            })
                                                        }
                                                    >
                                                        <Trash2 aria-hidden="true" />
                                                    </Button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </article>
                        ))
                    )}
                </section>
            </div>

            <Dialog
                open={sheet !== null}
                onOpenChange={(open) => !open && setSheet(null)}
            >
                <DialogContent>
                    {sheet?.type === 'edit' && (
                        <TransactionForm
                            kind={kind}
                            movement={sheet.movement}
                            accounts={props.accounts}
                            categories={props.categories}
                            today={props.today}
                            onDone={() => setSheet(null)}
                        />
                    )}
                    {sheet?.type === 'delete' && (
                        <>
                            <DialogTitle>
                                ¿Borrar «{sheet.movement.concept}»?
                            </DialogTitle>
                            <DialogDescription>
                                Desaparecerá de tus{' '}
                                {isExpense ? 'gastos' : 'ingresos'} y tus
                                cuentas se recalcularán al momento.
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
                                            TransactionController.destroy.url(
                                                sheet.movement.id,
                                            ),
                                            'delete',
                                        );
                                        setSheet(null);
                                    }}
                                >
                                    Borrar
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
