import { Form, Head } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    CalendarDays,
    Info,
    MoreHorizontal,
    Pencil,
    Plus,
    Sparkles,
    Target,
} from 'lucide-react';
import { useState } from 'react';
import SavingsGoalController from '@/actions/App/Http/Controllers/Finance/SavingsGoalController';
import AmountInput from '@/components/finance/amount-input';
import {
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    COLOR_LABELS,
    CategoryIcon,
} from '@/components/finance/category-badge';
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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { quickAction } from '@/lib/actions';
import { normalizeAmountFields } from '@/lib/amount';
import { cn } from '@/lib/utils';
import { index as goalsIndex } from '@/routes/goals';

type Goal = {
    id: number;
    name: string;
    icon: string;
    color: string;
    target_amount: string;
    saved: string;
    remaining: string;
    percent: number;
    target_date: string | null;
    achieved: boolean;
    archived: boolean;
    contributions: {
        id: number;
        amount: string;
        contributed_on: string;
        note: string | null;
    }[];
};

type Props = {
    goals: Goal[];
    icons: string[];
    colors: string[];
    today: string;
};

type DialogState =
    | { type: 'goal'; goal: Goal | null }
    | { type: 'contribute'; goal: Goal; direction: 'deposit' | 'withdraw' }
    | null;

export default function GoalsIndex({ goals, icons, colors, today }: Props) {
    const [dialog, setDialog] = useState<DialogState>(null);

    return (
        <>
            <Head title="Objetivos de ahorro" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Objetivos de ahorro"
                        description="Ponle nombre a lo que quieres conseguir y sigue tu avance."
                    />
                    <Button
                        onClick={() => setDialog({ type: 'goal', goal: null })}
                    >
                        <Plus aria-hidden="true" />
                        Nuevo objetivo
                    </Button>
                </div>

                <p className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                    <Info
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    Las aportaciones reservan dinero para el objetivo, pero no
                    lo mueven entre cuentas. Si quieres apartarlo de verdad, haz
                    también una transferencia a tu cuenta de ahorro.
                </p>

                {goals.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                        <Target
                            className="mx-auto mb-3 size-8 text-primary"
                            aria-hidden="true"
                        />
                        <h2 className="font-semibold">
                            Crea tu primer objetivo
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            Un fondo para imprevistos, unas vacaciones o la
                            entrada de una casa. Cada paso cuenta.
                        </p>
                    </div>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {goals.map((goal) => (
                            <GoalCard
                                key={goal.id}
                                goal={goal}
                                onEdit={() => setDialog({ type: 'goal', goal })}
                                onContribute={(direction) =>
                                    setDialog({
                                        type: 'contribute',
                                        goal,
                                        direction,
                                    })
                                }
                            />
                        ))}
                    </ul>
                )}
            </div>

            <Dialog
                open={dialog !== null}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto">
                    {dialog?.type === 'goal' && (
                        <GoalForm
                            goal={dialog.goal}
                            icons={icons}
                            colors={colors}
                            onDone={() => setDialog(null)}
                        />
                    )}
                    {dialog?.type === 'contribute' && (
                        <ContributionForm
                            goal={dialog.goal}
                            direction={dialog.direction}
                            today={today}
                            onDone={() => setDialog(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function GoalCard({
    goal,
    onEdit,
    onContribute,
}: {
    goal: Goal;
    onEdit: () => void;
    onContribute: (direction: 'deposit' | 'withdraw') => void;
}) {
    const format = useFormat();

    return (
        <li
            className={cn(
                'flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs',
                goal.archived && 'opacity-70',
            )}
        >
            <div className="flex items-start gap-3">
                <CategoryIcon icon={goal.icon} color={goal.color} />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{goal.name}</h2>
                    {goal.target_date && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays
                                className="size-3.5"
                                aria-hidden="true"
                            />
                            Para el {format.day(goal.target_date)}
                        </p>
                    )}
                </div>
                {goal.achieved && (
                    <Badge variant="secondary">
                        <Sparkles aria-hidden="true" />
                        ¡Conseguido!
                    </Badge>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Acciones para ${goal.name}`}
                        >
                            <MoreHorizontal aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil aria-hidden="true" />
                            Editar
                        </DropdownMenuItem>
                        {goal.archived ? (
                            <DropdownMenuItem
                                onSelect={() =>
                                    quickAction(
                                        SavingsGoalController.restore.url(
                                            goal.id,
                                        ),
                                    )
                                }
                            >
                                <ArchiveRestore aria-hidden="true" />
                                Restaurar
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onSelect={() =>
                                    quickAction(
                                        SavingsGoalController.archive.url(
                                            goal.id,
                                        ),
                                    )
                                }
                            >
                                <Archive aria-hidden="true" />
                                Archivar
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="space-y-2">
                <p className="text-sm">
                    <span className="text-xl font-semibold tabular-nums">
                        {format.money(goal.saved)}
                    </span>
                    <span className="text-muted-foreground">
                        {' '}
                        de {format.money(goal.target_amount)}
                    </span>
                </p>
                <ProgressBar
                    value={goal.percent}
                    label={`Progreso de ${goal.name}`}
                    valueText={`${goal.percent} %`}
                    tone={goal.achieved ? 'done' : 'default'}
                />
                <p className="text-xs text-muted-foreground">
                    {goal.achieved
                        ? 'Has llegado a la meta.'
                        : `${goal.percent} % · faltan ${format.money(goal.remaining)}`}
                </p>
            </div>

            {!goal.archived && (
                <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onContribute('deposit')}>
                        Aportar
                    </Button>
                    {Number(goal.saved) > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onContribute('withdraw')}
                        >
                            Retirar
                        </Button>
                    )}
                </div>
            )}

            {goal.contributions.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                        Últimas aportaciones
                    </summary>
                    <ul className="mt-2 space-y-1">
                        {goal.contributions.map((c) => (
                            <li
                                key={c.id}
                                className="flex justify-between gap-2 text-xs"
                            >
                                <span className="truncate">
                                    {format.day(c.contributed_on)}
                                    {c.note && ` · ${c.note}`}
                                </span>
                                <span className="tabular-nums">
                                    {format.money(c.amount)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </li>
    );
}

function GoalForm({
    goal,
    icons,
    colors,
    onDone,
}: {
    goal: Goal | null;
    icons: string[];
    colors: string[];
    onDone: () => void;
}) {
    const format = useFormat();
    const [icon, setIcon] = useState(goal?.icon ?? 'piggy-bank');
    const [color, setColor] = useState(goal?.color ?? 'teal');
    const form = goal
        ? SavingsGoalController.update.form(goal.id)
        : SavingsGoalController.store.form();

    return (
        <Form
            {...form}
            transform={(data) =>
                normalizeAmountFields(
                    data,
                    ['target_amount'],
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
                        {goal ? 'Editar objetivo' : 'Nuevo objetivo'}
                    </DialogTitle>
                    <DialogDescription>
                        Define cuánto quieres reunir y, si quieres, para cuándo.
                    </DialogDescription>

                    <div className="flex items-center gap-3">
                        <CategoryIcon icon={icon} color={color} />
                        <div className="grid flex-1 gap-2">
                            <Label htmlFor="goal-name">Nombre</Label>
                            <Input
                                id="goal-name"
                                name="name"
                                defaultValue={goal?.name}
                                placeholder="Ej.: Fondo para imprevistos"
                                required
                                maxLength={100}
                            />
                        </div>
                    </div>
                    <InputError message={errors.name} />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <AmountInput
                            id="goal-target"
                            name="target_amount"
                            label="Meta"
                            defaultValue={goal?.target_amount ?? null}
                            error={errors.target_amount}
                        />
                        <div className="grid gap-2">
                            <Label htmlFor="goal-date">
                                Fecha objetivo{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="goal-date"
                                name="target_date"
                                type="date"
                                defaultValue={goal?.target_date ?? ''}
                            />
                            <InputError message={errors.target_date} />
                        </div>
                    </div>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium">
                            Icono
                        </legend>
                        <div className="grid grid-cols-8 gap-2">
                            {icons.map((option) => {
                                const Icon = CATEGORY_ICONS[option];

                                return (
                                    <label
                                        key={option}
                                        className={cn(
                                            'flex aspect-square cursor-pointer items-center justify-center rounded-lg border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                                            icon === option
                                                ? 'border-primary bg-primary/10'
                                                : 'hover:bg-muted',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="icon"
                                            value={option}
                                            checked={icon === option}
                                            onChange={() => setIcon(option)}
                                            className="sr-only"
                                        />
                                        {Icon && (
                                            <Icon
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span className="sr-only">
                                            {option.replaceAll('-', ' ')}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium">
                            Color
                        </legend>
                        <div className="flex flex-wrap gap-2">
                            {colors.map((option) => (
                                <label
                                    key={option}
                                    title={COLOR_LABELS[option]}
                                    className={cn(
                                        'flex size-9 cursor-pointer items-center justify-center rounded-full border-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                                        color === option
                                            ? 'border-foreground'
                                            : 'border-transparent',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="color"
                                        value={option}
                                        checked={color === option}
                                        onChange={() => setColor(option)}
                                        className="sr-only"
                                    />
                                    <span
                                        className={cn(
                                            'size-6 rounded-full',
                                            CATEGORY_COLORS[option],
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        {COLOR_LABELS[option] ?? option}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {goal ? 'Guardar cambios' : 'Crear objetivo'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

function ContributionForm({
    goal,
    direction,
    today,
    onDone,
}: {
    goal: Goal;
    direction: 'deposit' | 'withdraw';
    today: string;
    onDone: () => void;
}) {
    const format = useFormat();
    const deposit = direction === 'deposit';

    return (
        <Form
            {...SavingsGoalController.contribute.form(goal.id)}
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
                        {deposit
                            ? `Aportar a «${goal.name}»`
                            : `Retirar de «${goal.name}»`}
                    </DialogTitle>
                    <DialogDescription>
                        {deposit
                            ? `Reservado hasta ahora: ${format.money(goal.saved)}. Faltan ${format.money(goal.remaining)}.`
                            : `Puedes liberar hasta ${format.money(goal.saved)} de lo reservado.`}
                    </DialogDescription>
                    <input type="hidden" name="direction" value={direction} />
                    <AmountInput
                        id="contribution-amount"
                        name="amount"
                        label="Importe"
                        error={errors.amount}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="contribution-date">Fecha</Label>
                            <Input
                                id="contribution-date"
                                name="contributed_on"
                                type="date"
                                defaultValue={today}
                                required
                            />
                            <InputError message={errors.contributed_on} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contribution-note">
                                Nota{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="contribution-note"
                                name="note"
                                maxLength={255}
                            />
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
                            {deposit ? 'Aportar' : 'Retirar'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

GoalsIndex.layout = {
    breadcrumbs: [{ title: 'Objetivos', href: goalsIndex() }],
};
