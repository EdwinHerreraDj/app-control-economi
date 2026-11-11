import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Ban,
    HandCoins,
    CalendarClock,
    CircleCheck,
    ChevronLeft,
    ChevronRight,
    Minus,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import TransactionController from '@/actions/App/Http/Controllers/Finance/TransactionController';
import TransferController from '@/actions/App/Http/Controllers/Finance/TransferController';
import { CategoryIcon } from '@/components/finance/category-badge';
import {
    TransactionForm,
    TransferForm,
    VoidForm,
} from '@/components/finance/movement-forms';
import Heading from '@/components/heading';
import { Pagination } from '@/components/pagination';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useFormat } from '@/hooks/use-format';
import { quickAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { index as debtsIndex } from '@/routes/debts';
import { index as transactionsIndex } from '@/routes/transactions';
import type { Paginated } from '@/types';
import type {
    AccountOption,
    CategoryOption,
    Filters,
    FormMode,
    Movement,
    Summary,
} from '@/types/finance';

type Props = {
    transactions: Paginated<Movement>;
    filters: Filters;
    summary: Summary;
    accounts: AccountOption[];
    categories: CategoryOption[];
    today: string;
};

type DialogState =
    | FormMode
    | { type: 'void'; movement: Movement }
    | { type: 'delete'; movement: Movement }
    | null;

function visit(filters: Partial<Filters>) {
    const query = Object.fromEntries(
        Object.entries(filters).filter(
            ([, value]) =>
                value !== null && value !== '' && value !== undefined,
        ),
    ) as Record<string, string | number>;

    router.get(transactionsIndex.url({ query }), {}, { preserveState: true });
}

function shiftMonth(month: string, delta: number): string {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, m - 1 + delta, 1));

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function postAction(url: string) {
    router.post(
        url,
        {},
        {
            preserveScroll: true,
            onError: (errors) => {
                const first = Object.values(errors)[0];

                if (first) {
                    toast.error(first);
                }
            },
        },
    );
}

export default function TransactionsIndex({
    transactions,
    filters,
    summary,
    accounts,
    categories,
    today,
}: Props) {
    const format = useFormat();
    const [dialog, setDialog] = useState<DialogState>(null);
    const { url } = usePage();

    // Acciones rápidas desde otras pantallas: /transactions?new=expense
    useEffect(() => {
        const requested = new URLSearchParams(url.split('?')[1] ?? '').get(
            'new',
        );

        if (
            requested === 'expense' ||
            requested === 'income' ||
            requested === 'transfer'
        ) {
            setDialog({ type: requested, movement: null });
        }
    }, [url]);

    const monthLabel = useMemo(() => {
        const [year, month] = filters.month.split('-').map(Number);

        return new Intl.DateTimeFormat(format.preferences.number_locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(year, month - 1, 1)));
    }, [filters.month, format.preferences.number_locale]);

    const groups = useMemo(() => {
        const byDate = new Map<string, Movement[]>();

        for (const movement of transactions.data) {
            byDate.set(movement.occurred_on, [
                ...(byDate.get(movement.occurred_on) ?? []),
                movement,
            ]);
        }

        return [...byDate.entries()];
    }, [transactions.data]);

    const hasFilters =
        filters.kind ||
        filters.status ||
        filters.account ||
        filters.category ||
        filters.search;

    const edit = (movement: Movement) => {
        if (movement.voided || movement.debt_managed) {
            return;
        }

        setDialog(
            movement.transfer
                ? { type: 'transfer', movement }
                : {
                      type: movement.kind as 'income' | 'expense',
                      movement,
                  },
        );
    };

    return (
        <>
            <Head title="Movimientos" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Movimientos"
                        description="Ingresos, gastos y transferencias entre tus cuentas."
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() =>
                                setDialog({ type: 'expense', movement: null })
                            }
                        >
                            <Minus aria-hidden="true" />
                            Gasto
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                setDialog({ type: 'income', movement: null })
                            }
                        >
                            <Plus aria-hidden="true" />
                            Ingreso
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setDialog({ type: 'transfer', movement: null })
                            }
                        >
                            <ArrowLeftRight aria-hidden="true" />
                            Transferencia
                        </Button>
                    </div>
                </div>

                <nav
                    aria-label="Mes"
                    className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-2 shadow-xs"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mes anterior"
                        onClick={() =>
                            visit({
                                ...filters,
                                month: shiftMonth(filters.month, -1),
                            })
                        }
                    >
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <h2 className="text-base font-semibold first-letter:uppercase">
                        {monthLabel}
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mes siguiente"
                        onClick={() =>
                            visit({
                                ...filters,
                                month: shiftMonth(filters.month, 1),
                            })
                        }
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </nav>

                <section
                    aria-label="Resumen del mes"
                    className="grid grid-cols-2 gap-3 lg:grid-cols-4"
                >
                    <SummaryCard
                        label="Ingresos"
                        value={format.money(summary.income)}
                        hint={
                            Number(summary.planned_income) !== 0
                                ? `+ ${format.money(summary.planned_income)} pendientes de cobrar`
                                : 'Cobrados este mes'
                        }
                    />
                    <SummaryCard
                        label="Gastos"
                        value={format.money(summary.expense)}
                        hint={
                            Number(summary.planned_expense) !== 0
                                ? `+ ${format.money(summary.planned_expense)} pendientes de pagar`
                                : 'Pagados este mes'
                        }
                    />
                    <SummaryCard
                        label="Diferencia"
                        value={format.money(summary.net)}
                        hint="Lo cobrado menos lo pagado"
                        className="col-span-2 lg:col-span-2"
                    />
                </section>

                <FiltersBar
                    filters={filters}
                    accounts={accounts}
                    categories={categories}
                />

                {transactions.data.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                        <p className="font-medium">
                            {hasFilters
                                ? 'Ningún movimiento coincide con los filtros.'
                                : 'No hay movimientos este mes.'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {hasFilters
                                ? 'Prueba a quitar algún filtro.'
                                : 'Registra un gasto o un ingreso para empezar.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {groups.map(([date, movements]) => (
                            <section key={date} aria-label={format.day(date)}>
                                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                                    <time dateTime={date}>
                                        {format.day(date)}
                                    </time>
                                </h3>
                                <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                                    {movements.map((movement) => (
                                        <MovementRow
                                            key={movement.id}
                                            movement={movement}
                                            accountFilter={filters.account}
                                            onEdit={() => edit(movement)}
                                            onVoid={() =>
                                                setDialog({
                                                    // Las transferencias se anulan; el resto se borra.
                                                    type: movement.transfer
                                                        ? 'void'
                                                        : 'delete',
                                                    movement,
                                                })
                                            }
                                        />
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}

                <Pagination page={transactions} />
            </div>

            <Dialog
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent>
                    {dialog?.type === 'delete' && (
                        <>
                            <DialogTitle>
                                ¿Borrar «{dialog.movement.concept}»?
                            </DialogTitle>
                            <DialogDescription>
                                Desaparecerá de tus movimientos y tus cuentas se
                                recalcularán al momento.
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
                                                dialog.movement.id,
                                            ),
                                            'delete',
                                        );
                                        setDialog(null);
                                    }}
                                >
                                    Borrar
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                    {dialog?.type === 'void' && (
                        <VoidForm
                            movement={dialog.movement}
                            onDone={() => setDialog(null)}
                        />
                    )}
                    {(dialog?.type === 'income' ||
                        dialog?.type === 'expense') && (
                        <TransactionForm
                            kind={dialog.type}
                            movement={dialog.movement}
                            accounts={accounts}
                            categories={categories}
                            today={today}
                            onDone={() => setDialog(null)}
                        />
                    )}
                    {dialog?.type === 'transfer' && (
                        <TransferForm
                            movement={dialog.movement}
                            accounts={accounts}
                            today={today}
                            onDone={() => setDialog(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function SummaryCard({
    label,
    value,
    hint,
    className,
}: {
    label: string;
    value: string;
    hint: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'rounded-2xl border bg-card p-4 shadow-xs',
                className,
            )}
        >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
    );
}

function FiltersBar({
    filters,
    accounts,
    categories,
}: {
    filters: Filters;
    accounts: AccountOption[];
    categories: CategoryOption[];
}) {
    const update = (changes: Partial<Filters>) =>
        visit({ ...filters, ...changes });

    return (
        <form
            role="search"
            aria-label="Filtrar movimientos"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get('search');
                update({
                    search: typeof value === 'string' ? value.trim() : '',
                });
            }}
        >
            <div className="relative sm:col-span-2 lg:col-span-1">
                <Label htmlFor="filter-search" className="sr-only">
                    Buscar por concepto o notas
                </Label>
                <Search
                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    id="filter-search"
                    name="search"
                    type="search"
                    defaultValue={filters.search}
                    placeholder="Buscar"
                    className="pl-9"
                />
            </div>

            <FilterSelect
                id="filter-kind"
                label="Tipo"
                value={filters.kind ?? ''}
                onChange={(value) =>
                    update({ kind: (value || null) as Filters['kind'] })
                }
                options={[
                    ['', 'Todos los tipos'],
                    ['expense', 'Gastos'],
                    ['income', 'Ingresos'],
                    ['transfer', 'Transferencias'],
                ]}
            />
            <FilterSelect
                id="filter-status"
                label="Estado"
                value={filters.status ?? ''}
                onChange={(value) =>
                    update({ status: (value || null) as Filters['status'] })
                }
                options={[
                    ['', 'Todos los estados'],
                    ['confirmed', 'Pagados o cobrados'],
                    ['planned', 'Pendientes'],
                    ['voided', 'Anulados'],
                ]}
            />
            <FilterSelect
                id="filter-account"
                label="Cuenta"
                value={String(filters.account ?? '')}
                onChange={(value) =>
                    update({ account: value ? Number(value) : null })
                }
                options={[
                    ['', 'Todas las cuentas'],
                    ...accounts.map(
                        (account) =>
                            [String(account.id), account.name] as [
                                string,
                                string,
                            ],
                    ),
                ]}
            />
            <FilterSelect
                id="filter-category"
                label="Categoría"
                value={String(filters.category ?? '')}
                onChange={(value) =>
                    update({ category: value ? Number(value) : null })
                }
                options={[
                    ['', 'Todas las categorías'],
                    ...categories.map(
                        (category) =>
                            [String(category.id), category.name] as [
                                string,
                                string,
                            ],
                    ),
                ]}
            />
        </form>
    );
}

function FilterSelect({
    id,
    label,
    value,
    onChange,
    options,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: [string, string][];
}) {
    return (
        <div>
            <Label htmlFor={id} className="sr-only">
                {label}
            </Label>
            <NativeSelect
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>
                        {optionLabel}
                    </option>
                ))}
            </NativeSelect>
        </div>
    );
}

function MovementRow({
    movement,
    accountFilter,
    onEdit,
    onVoid,
}: {
    movement: Movement;
    accountFilter: number | null;
    onEdit: () => void;
    onVoid: () => void;
}) {
    const format = useFormat();
    const transfer = movement.transfer;
    const isIncome = movement.kind === 'income';
    const isPlanned = movement.status === 'planned' && !movement.voided;

    // Una transferencia sin filtro de cuenta es neutra; dentro de una cuenta,
    // es una entrada o una salida de esa cuenta.
    let sign = '';
    let srSign = '';
    if (
        movement.kind === 'income' ||
        movement.kind === 'debt_in' ||
        (accountFilter && movement.kind === 'transfer_in')
    ) {
        sign = '+';
        srSign = 'Entrada de ';
    } else if (
        movement.kind === 'expense' ||
        movement.kind === 'debt_out' ||
        (accountFilter && movement.kind === 'transfer_out')
    ) {
        sign = '−';
        srSign = 'Salida de ';
    }

    const confirmLabel = transfer
        ? 'Marcar como realizada'
        : isIncome
          ? 'Marcar como cobrado'
          : 'Marcar como pagado';
    const confirm = () =>
        postAction(
            transfer
                ? TransferController.confirm.url(transfer.id)
                : TransactionController.confirm.url(movement.id),
        );

    return (
        <li
            className={cn(
                'flex items-center gap-3 p-3 sm:p-4',
                movement.voided && 'opacity-60',
            )}
        >
            {transfer || !movement.category ? (
                <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
                    aria-hidden="true"
                >
                    {transfer ? (
                        <ArrowLeftRight className="size-4.5" />
                    ) : (
                        <HandCoins className="size-4.5" />
                    )}
                </span>
            ) : (
                <CategoryIcon
                    icon={movement.category?.icon ?? 'tag'}
                    color={movement.category?.color ?? 'slate'}
                />
            )}

            <button
                type="button"
                onClick={onEdit}
                disabled={movement.voided || movement.debt_managed}
                className="min-w-0 flex-1 rounded-md text-left disabled:cursor-default"
            >
                <p
                    className={cn(
                        'truncate font-medium',
                        movement.voided && 'line-through',
                    )}
                >
                    {transfer?.concept || movement.concept}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {transfer
                        ? `${transfer.from.name} → ${transfer.to.name}`
                        : movement.kind === 'debt_in' ||
                            movement.kind === 'debt_out'
                          ? `Deuda (no es ingreso ni gasto) · ${movement.account.name}`
                          : `${movement.category?.name ?? 'Sin categoría'} · ${movement.account.name}`}
                </p>
                {movement.voided && movement.void_reason && (
                    <p className="truncate text-xs text-muted-foreground">
                        Anulado: {movement.void_reason}
                    </p>
                )}
            </button>

            <div className="flex flex-col items-end gap-1">
                <p
                    className={cn(
                        'font-semibold whitespace-nowrap tabular-nums',
                        sign === '+' && 'text-primary',
                        movement.voided && 'line-through',
                    )}
                >
                    <span className="sr-only">{srSign}</span>
                    <span aria-hidden="true">{sign} </span>
                    {format.money(movement.amount, movement.currency)}
                </p>
                {movement.voided ? (
                    <Badge variant="outline">
                        <Ban aria-hidden="true" />
                        Anulado
                    </Badge>
                ) : (
                    isPlanned &&
                    // Lo pendiente se marca con un toque, sin abrir el menú.
                    (movement.debt_managed ? (
                        <Badge variant="outline">
                            <CalendarClock aria-hidden="true" />
                            Pendiente
                        </Badge>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={confirm}
                            aria-label={`Pendiente. ${confirmLabel}: ${transfer?.concept || movement.concept}`}
                        >
                            <CircleCheck aria-hidden="true" />
                            {transfer
                                ? 'Marcar hecha'
                                : isIncome
                                  ? 'Marcar cobrado'
                                  : 'Marcar pagado'}
                        </Button>
                    ))
                )}
            </div>

            {movement.debt_managed && !movement.voided && (
                <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    aria-label="Gestionar en Deudas"
                >
                    <Link href={debtsIndex()}>
                        <HandCoins aria-hidden="true" />
                    </Link>
                </Button>
            )}

            {!movement.voided && !movement.debt_managed && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Acciones para ${movement.concept}`}
                        >
                            <MoreHorizontal aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil aria-hidden="true" />
                            Editar
                        </DropdownMenuItem>
                        {isPlanned && (
                            <DropdownMenuItem onSelect={confirm}>
                                <CircleCheck aria-hidden="true" />
                                {confirmLabel}
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={onVoid}
                        >
                            <Ban aria-hidden="true" />
                            {transfer ? 'Anular' : 'Borrar'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </li>
    );
}

TransactionsIndex.layout = {
    breadcrumbs: [{ title: 'Movimientos', href: transactionsIndex() }],
};
