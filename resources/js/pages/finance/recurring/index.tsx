import { Form, Head } from '@inertiajs/react';
import {
    CalendarClock,
    HandCoins,
    MoreHorizontal,
    Pause,
    Pencil,
    Play,
    Plus,
    Repeat,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import RecurringRuleController from '@/actions/App/Http/Controllers/Finance/RecurringRuleController';
import AmountInput from '@/components/finance/amount-input';
import { CategoryIcon } from '@/components/finance/category-badge';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
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
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { quickAction } from '@/lib/actions';
import { normalizeAmountFields } from '@/lib/amount';
import { cn } from '@/lib/utils';
import { index as recurringIndex } from '@/routes/recurring';
import type { AccountOption, CategoryOption } from '@/types/finance';

type Rule = {
    id: number;
    kind: 'income' | 'expense';
    concept: string;
    amount: string;
    currency: string;
    account: { id: number; name: string };
    category: { id: number; name: string; icon: string; color: string };
    nature: 'fixed' | 'variable' | null;
    frequency: string;
    frequency_label: string;
    starts_on: string;
    ends_on: string | null;
    next_on: string | null;
    paused: boolean;
};

type Upcoming = {
    type: 'movement' | 'debt';
    id: number;
    kind: 'income' | 'expense';
    date: string;
    overdue: boolean;
    concept: string;
    amount: string | null;
    account: string | null;
    category: { name: string; icon: string; color: string } | null;
    recurring: boolean;
};

type Props = {
    rules: Rule[];
    upcoming: Upcoming[];
    upcomingDays: number;
    accounts: AccountOption[];
    categories: CategoryOption[];
    frequencies: { value: string; label: string }[];
    today: string;
};

type DialogState =
    | { type: 'form'; kind: 'income' | 'expense'; rule: Rule | null }
    | { type: 'delete'; rule: Rule }
    | null;

export default function RecurringIndex(props: Props) {
    const { rules, upcoming, upcomingDays } = props;
    const [dialog, setDialog] = useState<DialogState>(null);

    return (
        <>
            <Head title="Recurrentes y vencimientos" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Recurrentes y vencimientos"
                        description="Anticipa tus compromisos: lo que cobrarás y pagarás en las próximas semanas."
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() =>
                                setDialog({
                                    type: 'form',
                                    kind: 'expense',
                                    rule: null,
                                })
                            }
                        >
                            <Plus aria-hidden="true" />
                            Gasto recurrente
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                setDialog({
                                    type: 'form',
                                    kind: 'income',
                                    rule: null,
                                })
                            }
                        >
                            <Plus aria-hidden="true" />
                            Ingreso recurrente
                        </Button>
                    </div>
                </div>

                <section aria-labelledby="upcoming-title" className="space-y-3">
                    <h2 id="upcoming-title" className="font-semibold">
                        Próximos {upcomingDays} días
                    </h2>
                    {upcoming.length === 0 ? (
                        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No hay cobros ni pagos previstos en este periodo.
                        </p>
                    ) : (
                        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                            {upcoming.map((item) => (
                                <UpcomingRow
                                    key={`${item.type}-${item.id}`}
                                    item={item}
                                />
                            ))}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Son previsiones: no cuentan en tu saldo hasta que las
                        marcas como cobradas o pagadas en Movimientos.
                    </p>
                </section>

                <section aria-labelledby="rules-title" className="space-y-3">
                    <h2 id="rules-title" className="font-semibold">
                        Ingresos y gastos que se repiten
                    </h2>
                    {rules.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-center">
                            <Repeat
                                className="mx-auto mb-2 size-7 text-primary"
                                aria-hidden="true"
                            />
                            <p className="text-sm text-muted-foreground">
                                Añade tu nómina, el alquiler o tus suscripciones
                                para verlos venir con tiempo.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                            {rules.map((rule) => (
                                <RuleRow
                                    key={rule.id}
                                    rule={rule}
                                    onEdit={() =>
                                        setDialog({
                                            type: 'form',
                                            kind: rule.kind,
                                            rule,
                                        })
                                    }
                                    onDelete={() =>
                                        setDialog({ type: 'delete', rule })
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <Dialog
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent>
                    {dialog?.type === 'form' && (
                        <RuleForm
                            {...props}
                            kind={dialog.kind}
                            rule={dialog.rule}
                            onDone={() => setDialog(null)}
                        />
                    )}
                    {dialog?.type === 'delete' && (
                        <>
                            <DialogTitle>
                                ¿Eliminar «{dialog.rule.concept}»?
                            </DialogTitle>
                            <DialogDescription>
                                Se quitarán sus previsiones pendientes. Los
                                movimientos que ya confirmaste se conservan. Si
                                solo quieres detenerla un tiempo, ponla en
                                pausa.
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
                                                dialog.rule.id,
                                            ),
                                            'delete',
                                        );
                                        setDialog(null);
                                    }}
                                >
                                    Eliminar
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function UpcomingRow({ item }: { item: Upcoming }) {
    const format = useFormat();
    const isIncome = item.kind === 'income';

    return (
        <li className="flex items-center gap-3 p-3 sm:p-4">
            {item.category ? (
                <CategoryIcon
                    icon={item.category.icon}
                    color={item.category.color}
                />
            ) : (
                <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
                    aria-hidden="true"
                >
                    <HandCoins className="size-4.5" />
                </span>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.concept}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <CalendarClock
                            className="size-3.5"
                            aria-hidden="true"
                        />
                        {format.day(item.date)}
                    </span>
                    {item.account && <span>· {item.account}</span>}
                </p>
            </div>
            <div className="flex flex-col items-end gap-1">
                <p
                    className={cn(
                        'font-semibold whitespace-nowrap tabular-nums',
                        isIncome && 'text-primary',
                    )}
                >
                    {item.amount === null ? (
                        <span className="text-sm font-normal text-muted-foreground">
                            Importe sin indicar
                        </span>
                    ) : (
                        <>
                            <span className="sr-only">
                                {isIncome ? 'Cobro de ' : 'Pago de '}
                            </span>
                            <span aria-hidden="true">
                                {isIncome ? '+ ' : '− '}
                            </span>
                            {format.money(item.amount)}
                        </>
                    )}
                </p>
                {item.overdue && (
                    <Badge variant="outline">
                        <TriangleAlert aria-hidden="true" />
                        Fecha pasada, sin confirmar
                    </Badge>
                )}
            </div>
        </li>
    );
}

function RuleRow({
    rule,
    onEdit,
    onDelete,
}: {
    rule: Rule;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const format = useFormat();

    return (
        <li
            className={cn(
                'flex items-center gap-3 p-3 sm:p-4',
                rule.paused && 'opacity-70',
            )}
        >
            <CategoryIcon
                icon={rule.category.icon}
                color={rule.category.color}
            />
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{rule.concept}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {rule.frequency_label} · {rule.account.name}
                    {rule.next_on && ` · próxima: ${format.day(rule.next_on)}`}
                    {rule.ends_on && ` · hasta ${format.day(rule.ends_on)}`}
                </p>
            </div>
            <div className="flex flex-col items-end gap-1">
                <p
                    className={cn(
                        'font-semibold whitespace-nowrap tabular-nums',
                        rule.kind === 'income' && 'text-primary',
                    )}
                >
                    <span aria-hidden="true">
                        {rule.kind === 'income' ? '+ ' : '− '}
                    </span>
                    {format.money(rule.amount, rule.currency)}
                </p>
                {rule.paused && <Badge variant="outline">En pausa</Badge>}
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Acciones para ${rule.concept}`}
                    >
                        <MoreHorizontal aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={onEdit}>
                        <Pencil aria-hidden="true" />
                        Editar
                    </DropdownMenuItem>
                    {rule.paused ? (
                        <DropdownMenuItem
                            onSelect={() =>
                                quickAction(
                                    RecurringRuleController.resume.url(rule.id),
                                )
                            }
                        >
                            <Play aria-hidden="true" />
                            Reanudar
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            onSelect={() =>
                                quickAction(
                                    RecurringRuleController.pause.url(rule.id),
                                )
                            }
                        >
                            <Pause aria-hidden="true" />
                            Poner en pausa
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        <Trash2 aria-hidden="true" />
                        Eliminar
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

function RuleForm({
    kind,
    rule,
    accounts,
    categories,
    frequencies,
    today,
    onDone,
}: Props & {
    kind: 'income' | 'expense';
    rule: Rule | null;
    onDone: () => void;
}) {
    const format = useFormat();
    const isExpense = kind === 'expense';
    const form = rule
        ? RecurringRuleController.update.form(rule.id)
        : RecurringRuleController.store.form();
    const accountOptions = accounts.filter(
        (a) => !a.archived || a.id === rule?.account.id,
    );
    const categoryOptions = categories.filter(
        (c) => c.kind === kind && (!c.archived || c.id === rule?.category.id),
    );

    if (accountOptions.length === 0) {
        return (
            <>
                <DialogTitle>
                    {isExpense ? 'Gasto recurrente' : 'Ingreso recurrente'}
                </DialogTitle>
                <DialogDescription>
                    Antes, crea al menos una cuenta en el apartado Cuentas.
                </DialogDescription>
            </>
        );
    }

    return (
        <Form
            {...form}
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
                        {rule
                            ? 'Editar recurrencia'
                            : isExpense
                              ? 'Nuevo gasto recurrente'
                              : 'Nuevo ingreso recurrente'}
                    </DialogTitle>
                    <DialogDescription>
                        {rule
                            ? 'Las previsiones pendientes se recalcularán; las ya confirmadas no cambian.'
                            : 'Se crearán previsiones para las próximas fechas. Nunca se dan por cobradas o pagadas.'}
                    </DialogDescription>

                    {!rule && <input type="hidden" name="kind" value={kind} />}

                    <AmountInput
                        id="rule-amount"
                        name="amount"
                        label="Importe"
                        defaultValue={rule?.amount ?? null}
                        error={errors.amount}
                    />

                    <div className="grid gap-2">
                        <Label htmlFor="rule-concept">Concepto</Label>
                        <Input
                            id="rule-concept"
                            name="concept"
                            defaultValue={rule?.concept}
                            placeholder={
                                isExpense ? 'Ej.: Alquiler' : 'Ej.: Nómina'
                            }
                            required
                            maxLength={255}
                        />
                        <InputError message={errors.concept} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="rule-category">Categoría</Label>
                            <NativeSelect
                                id="rule-category"
                                name="category_id"
                                defaultValue={
                                    rule?.category.id ?? categoryOptions[0]?.id
                                }
                            >
                                {categoryOptions.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.category_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="rule-account">
                                {isExpense ? 'Se paga desde' : 'Se cobra en'}
                            </Label>
                            <NativeSelect
                                id="rule-account"
                                name="account_id"
                                defaultValue={
                                    rule?.account.id ?? accountOptions[0].id
                                }
                            >
                                {accountOptions.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.account_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="rule-frequency">Frecuencia</Label>
                            <NativeSelect
                                id="rule-frequency"
                                name="frequency"
                                defaultValue={rule?.frequency ?? 'monthly'}
                            >
                                {frequencies.map((f) => (
                                    <option key={f.value} value={f.value}>
                                        {f.label}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.frequency} />
                        </div>
                        {isExpense && (
                            <div className="grid gap-2">
                                <Label htmlFor="rule-nature">
                                    Tipo de gasto
                                </Label>
                                <NativeSelect
                                    id="rule-nature"
                                    name="nature"
                                    defaultValue={rule?.nature ?? 'fixed'}
                                >
                                    <option value="fixed">Fijo</option>
                                    <option value="variable">Variable</option>
                                </NativeSelect>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="rule-start">Primera fecha</Label>
                            <Input
                                id="rule-start"
                                name="starts_on"
                                type="date"
                                defaultValue={rule?.starts_on ?? today}
                                required
                            />
                            <InputError message={errors.starts_on} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="rule-end">
                                Hasta{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="rule-end"
                                name="ends_on"
                                type="date"
                                defaultValue={rule?.ends_on ?? ''}
                            />
                            <InputError message={errors.ends_on} />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {rule ? 'Guardar cambios' : 'Crear'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

RecurringIndex.layout = {
    breadcrumbs: [{ title: 'Recurrentes', href: recurringIndex() }],
};
