import { Form, Head, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    Info,
    Pencil,
    TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import BudgetController from '@/actions/App/Http/Controllers/Finance/BudgetController';
import AmountInput from '@/components/finance/amount-input';
import { CategoryIcon } from '@/components/finance/category-badge';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { quickAction } from '@/lib/actions';
import { normalizeAmountFields } from '@/lib/amount';
import { index as budgetsIndex } from '@/routes/budgets';

type Status = 'none' | 'ok' | 'near' | 'over' | 'over_planned';

type Row = {
    category: {
        id: number;
        name: string;
        icon: string;
        color: string;
        archived: boolean;
    };
    limit: string | null;
    spent: string;
    planned: string;
    remaining: string | null;
    percent: number | null;
    status: Status;
};

type Props = {
    month: string;
    rows: Row[];
    totals: { limit: string; spent: string; planned: string };
    warningPercent: number;
};

function shiftMonth(month: string, delta: number): string {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, m - 1 + delta, 1));

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetsIndex({ month, rows, totals }: Props) {
    const format = useFormat();
    const [editing, setEditing] = useState<Row | null>(null);
    const withBudget = rows.filter((row) => row.limit !== null);
    const withoutBudget = rows.filter((row) => row.limit === null);

    const monthLabel = useMemo(() => {
        const [year, m] = month.split('-').map(Number);

        return new Intl.DateTimeFormat(format.preferences.number_locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(year, m - 1, 1)));
    }, [month, format.preferences.number_locale]);

    const go = (delta: number) =>
        router.get(
            budgetsIndex.url({ query: { month: shiftMonth(month, delta) } }),
            {},
            { preserveState: true },
        );

    return (
        <>
            <Head title="Presupuestos" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <Heading
                    title="Presupuestos"
                    description="Ponte un límite mensual por categoría y compáralo con lo que llevas gastado y lo que tienes previsto."
                />

                <nav
                    aria-label="Mes"
                    className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-2 shadow-xs"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mes anterior"
                        onClick={() => go(-1)}
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
                        onClick={() => go(1)}
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </nav>

                <section
                    aria-label="Totales"
                    className="grid grid-cols-3 gap-3"
                >
                    {[
                        ['Presupuestado', totals.limit],
                        ['Gastado', totals.spent],
                        ['Previsto', totals.planned],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-2xl border bg-card p-4 shadow-xs"
                        >
                            <p className="text-xs text-muted-foreground sm:text-sm">
                                {label}
                            </p>
                            <p className="mt-1 font-semibold tabular-nums sm:text-xl">
                                {format.money(value)}
                            </p>
                        </div>
                    ))}
                </section>

                {withBudget.length > 0 && (
                    <ul className="grid gap-3 lg:grid-cols-2">
                        {withBudget.map((row) => (
                            <BudgetCard
                                key={row.category.id}
                                row={row}
                                onEdit={() => setEditing(row)}
                            />
                        ))}
                    </ul>
                )}

                <section
                    aria-labelledby="no-budget-title"
                    className="space-y-3"
                >
                    <h2
                        id="no-budget-title"
                        className="text-sm font-medium text-muted-foreground"
                    >
                        {withBudget.length === 0
                            ? 'Elige una categoría para ponerle un límite'
                            : 'Categorías sin presupuesto'}
                    </h2>
                    <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                        {withoutBudget.map((row) => (
                            <li
                                key={row.category.id}
                                className="flex items-center gap-3 p-3"
                            >
                                <CategoryIcon
                                    icon={row.category.icon}
                                    color={row.category.color}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">
                                        {row.category.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Gastado este mes:{' '}
                                        {format.money(row.spent)}
                                    </p>
                                </div>
                                {!row.category.archived && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditing(row)}
                                    >
                                        Poner límite
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>

                <p className="flex gap-2 text-xs text-muted-foreground">
                    <Info
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    Un presupuesto es una reserva orientativa: no mueve dinero
                    entre tus cuentas. El límite se aplica igual cada mes.
                </p>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent>
                    {editing && (
                        <BudgetForm
                            row={editing}
                            onDone={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function BudgetCard({ row, onEdit }: { row: Row; onEdit: () => void }) {
    const format = useFormat();
    const percent = row.percent ?? 0;

    const message: Record<Status, { icon: typeof Info; text: string }> = {
        none: { icon: Info, text: '' },
        ok: {
            icon: CircleCheck,
            text: `Te quedan ${format.money(row.remaining ?? '0')} contando lo previsto.`,
        },
        near: {
            icon: Info,
            text: `Llevas el ${percent} %. Te quedan ${format.money(row.remaining ?? '0')} contando lo previsto.`,
        },
        over_planned: {
            icon: TriangleAlert,
            text: `Con lo previsto superarías el límite en ${format.money((row.remaining ?? '0').replace('-', ''))}.`,
        },
        over: {
            icon: TriangleAlert,
            text: `Has superado el límite en ${format.money((row.remaining ?? '0').replace('-', ''))}.`,
        },
    };
    const { icon: StatusIcon, text } = message[row.status];

    return (
        <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
            <div className="flex items-center gap-3">
                <CategoryIcon
                    icon={row.category.icon}
                    color={row.category.color}
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.category.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                        {format.money(row.spent)} de{' '}
                        {format.money(row.limit ?? '0')}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Cambiar el límite de ${row.category.name}`}
                    onClick={onEdit}
                >
                    <Pencil aria-hidden="true" />
                </Button>
            </div>
            <ProgressBar
                value={percent}
                label={`Presupuesto de ${row.category.name}`}
                valueText={`${percent} % gastado`}
                tone={
                    row.status === 'over' || row.status === 'over_planned'
                        ? 'warning'
                        : 'default'
                }
            />
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <StatusIcon
                    className="mt-px size-3.5 shrink-0"
                    aria-hidden="true"
                />
                {text}
            </p>
        </li>
    );
}

function BudgetForm({ row, onDone }: { row: Row; onDone: () => void }) {
    const format = useFormat();

    return (
        <Form
            {...BudgetController.upsert.form(row.category.id)}
            transform={(data) =>
                normalizeAmountFields(
                    data,
                    ['amount'],
                    format.preferences.number_locale,
                )
            }
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-5"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>
                        Límite mensual · {row.category.name}
                    </DialogTitle>
                    <DialogDescription>
                        Cuánto quieres gastar como máximo cada mes en esta
                        categoría.
                    </DialogDescription>
                    <AmountInput
                        id="budget-amount"
                        name="amount"
                        label="Límite mensual"
                        defaultValue={row.limit}
                        error={errors.amount}
                    />
                    <DialogFooter className="gap-2 sm:justify-between">
                        {row.limit !== null ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    quickAction(
                                        BudgetController.destroy.url(
                                            row.category.id,
                                        ),
                                        'delete',
                                    );
                                    onDone();
                                }}
                            >
                                Quitar presupuesto
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex gap-2">
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">
                                    Cancelar
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                Guardar
                            </Button>
                        </div>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

BudgetsIndex.layout = {
    breadcrumbs: [{ title: 'Presupuestos', href: budgetsIndex() }],
};
