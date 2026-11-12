import { Link, router } from '@inertiajs/react';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    CalendarCheck,
    PiggyBank,
    ShoppingBag,
    Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AccountController from '@/actions/App/Http/Controllers/Finance/AccountController';
import TransactionController from '@/actions/App/Http/Controllers/Finance/TransactionController';
import TransferController from '@/actions/App/Http/Controllers/Finance/TransferController';
import { CategoryIcon } from '@/components/finance/category-badge';
import {
    closeQuick,
    matchPending,
    openQuick,
    quickPresetCategory,
    suggestCategory,
    useQuickView,
} from '@/components/quick/quick-store';
import type { QuickData } from '@/components/quick/quick-store';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { amountForInput, normalizeAmount } from '@/lib/amount';
import { cn } from '@/lib/utils';
import { newUuid } from '@/offline/storage';
import { index as paymentsIndex } from '@/routes/payments';
import { data as quickAddData } from '@/routes/quick-add';

type Errors = Record<string, string>;

const SPENDING_TYPES = [
    ['need', 'Algo necesario'],
    ['treat', 'Un gusto que me di'],
    ['habitual', 'Un pago habitual'],
    ['other', 'Otro'],
] as const;

function yesterday(today: string): string {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);

    return date.toISOString().slice(0, 10);
}

/** Botones de opción con aspecto de «chip», grandes y fáciles de tocar. */
function Chips<T extends string | number>({
    label,
    value,
    options,
    onChange,
    allowEmpty = false,
}: {
    label: string;
    value: T | null;
    options: readonly (readonly [T, string])[];
    onChange: (value: T | null) => void;
    allowEmpty?: boolean;
}) {
    return (
        <fieldset>
            <legend className="mb-2 text-sm font-medium">{label}</legend>
            <div className="flex flex-wrap gap-2">
                {options.map(([option, text]) => {
                    const active = value === option;

                    return (
                        <button
                            key={String(option)}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                                onChange(active && allowEmpty ? null : option)
                            }
                            className={cn(
                                'min-h-10 rounded-full border px-4 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'bg-background hover:bg-muted',
                            )}
                        >
                            {text}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

function useQuickData(open: boolean) {
    const [data, setData] = useState<QuickData | null>(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (!open) {
            return;
        }

        let active = true;

        fetch(quickAddData().url, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((json: QuickData | null) => {
                if (active) {
                    setData(json);
                }
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [open, version]);

    return { data, reload: () => setVersion((v) => v + 1) };
}

function AmountField({
    id,
    label,
    value,
    onChange,
    error,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    const format = useFormat();
    const normalized = normalizeAmount(value, format.preferences.number_locale);
    const valid = /^\d+(\.\d+)?$/.test(normalized) && Number(normalized) > 0;

    return (
        <div className="grid gap-2">
            <Label htmlFor={id} className="text-base">
                {label}
            </Label>
            <Input
                id={id}
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={amountForInput(
                    '0.00',
                    format.preferences.number_locale,
                )}
                className="h-14 text-3xl font-semibold tabular-nums md:text-3xl"
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-preview`}
            />
            <p
                id={`${id}-preview`}
                className="min-h-4 text-xs text-muted-foreground"
                aria-live="polite"
            >
                {value !== '' && valid
                    ? format.money(normalized as `${number}`)
                    : ''}
            </p>
            <InputError message={error} />
        </div>
    );
}

/**
 * «Gasté dinero» / «Me entró dinero»: lo mínimo (cuánto, en qué, cuándo) y
 * lo demás opcional. Si coincide con algo pendiente, se confirma eso.
 */
function QuickEntry({
    kind,
    data,
}: {
    kind: 'expense' | 'income';
    data: QuickData;
}) {
    const format = useFormat();
    const isExpense = kind === 'expense';
    const spendable = data.accounts.filter((a) => !a.savings);
    const accountsForKind = spendable.length > 0 ? spendable : data.accounts;
    const categories = data.categories.filter((c) => c.kind === kind);

    const [uuid] = useState(() => newUuid());
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    // Al tocar el icono de una categoría en «Gastos» o «Ingresos», llega elegida.
    const [chosenCategory, setChosenCategory] = useState<number | null>(() => {
        const preset = quickPresetCategory();

        return categories.some((c) => c.id === preset) ? preset : null;
    });
    const [date, setDate] = useState(data.today);
    const [otherDay, setOtherDay] = useState(false);
    const [accountId, setAccountId] = useState<number | null>(
        accountsForKind[0]?.id ?? null,
    );
    const [spendingType, setSpendingType] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [dismissed, setDismissed] = useState<number | null>(null);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const normalized = normalizeAmount(
        amount,
        format.preferences.number_locale,
    );
    const numeric = /^\d+(\.\d+)?$/.test(normalized)
        ? Number(normalized)
        : null;
    const suggested = suggestCategory(data, kind, concept);
    const categoryId =
        chosenCategory ?? suggested ?? data.fallback[kind] ?? categories[0]?.id;
    const category = categories.find((c) => c.id === categoryId);
    const match = useMemo(() => {
        const found = matchPending(
            data,
            kind,
            concept,
            categoryId ?? null,
            numeric,
        );

        return found && found.id !== dismissed ? found : null;
    }, [data, kind, concept, categoryId, numeric, dismissed]);

    if (accountsForKind.length === 0 || categoryId === undefined) {
        return (
            <p className="text-sm text-muted-foreground">
                Antes necesitamos saber dónde tienes tu dinero.{' '}
                <a href="/setup" className="text-primary underline">
                    Empezar
                </a>
            </p>
        );
    }

    const done = {
        onSuccess: () => closeQuick(),
        onError: (e: Errors) => setErrors(e),
        onFinish: () => setSaving(false),
        preserveScroll: true,
    };

    const save = () => {
        setSaving(true);
        router.post(
            TransactionController.store.url(),
            {
                kind,
                uuid,
                account_id: accountId,
                category_id: categoryId,
                amount: normalized,
                occurred_on: date,
                status: 'confirmed',
                concept: concept.trim() || category?.name || '',
                notes: notes.trim() || null,
                spending_type: isExpense ? spendingType : null,
            },
            done,
        );
    };

    const confirmMatch = () => {
        if (!match) {
            return;
        }

        setSaving(true);
        router.post(
            TransactionController.confirm.url(match.id),
            {
                amount: numeric !== null ? normalized : null,
                occurred_on: date,
                account_id: accountId,
            },
            done,
        );
    };

    return (
        <form
            className="grid gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
        >
            <DialogTitle className="text-xl">
                {isExpense ? 'Gasté dinero' : 'Me entró dinero'}
            </DialogTitle>
            <DialogDescription className="sr-only">
                {isExpense
                    ? 'Apunta un gasto: cuánto, en qué y cuándo.'
                    : 'Apunta un ingreso: cuánto, de dónde y cuándo.'}
            </DialogDescription>

            <AmountField
                id="quick-amount"
                label={isExpense ? '¿Cuánto gastaste?' : '¿Cuánto te entró?'}
                value={amount}
                onChange={setAmount}
                error={errors.amount}
            />

            <fieldset className="grid gap-2">
                <legend className="mb-1 text-base font-medium">
                    {isExpense ? '¿En qué?' : '¿De dónde?'}
                </legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {categories.map((c) => {
                        const active = c.id === categoryId;

                        return (
                            <button
                                key={c.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setChosenCategory(c.id)}
                                className={cn(
                                    'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                    active
                                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                                        : 'bg-card hover:bg-muted',
                                )}
                            >
                                <CategoryIcon icon={c.icon} color={c.color} />
                                <span className="line-clamp-2 leading-tight">
                                    {c.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <InputError message={errors.category_id} />
            </fieldset>

            <div className="grid gap-2">
                <Label htmlFor="quick-concept">
                    Detalle{' '}
                    <span className="font-normal text-muted-foreground">
                        (opcional)
                    </span>
                </Label>
                <Input
                    id="quick-concept"
                    value={concept}
                    onChange={(event) => setConcept(event.target.value)}
                    placeholder={
                        category
                            ? `Si no escribes nada: «${category.name}»`
                            : isExpense
                              ? 'Ej.: una cerveza con un amigo'
                              : 'Ej.: me pagaron el sueldo'
                    }
                    maxLength={255}
                    autoComplete="off"
                    list="quick-concepts"
                    aria-invalid={errors.concept ? true : undefined}
                />
                <datalist id="quick-concepts">
                    {data.history[kind].map((item) => (
                        <option key={item.concept} value={item.concept} />
                    ))}
                </datalist>
                <InputError message={errors.concept} />
            </div>
            {match && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
                    <p>
                        ¿Es tu <strong>{match.concept}</strong> del{' '}
                        {format.day(match.date)} ({format.money(match.amount)})?
                        Lo tenías como pendiente.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            onClick={confirmMatch}
                            disabled={saving}
                        >
                            Sí, es ese
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setDismissed(match.id)}
                        >
                            No, es otra cosa
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid gap-2">
                <Chips
                    label="¿Cuándo?"
                    value={
                        otherDay
                            ? 'other'
                            : date === data.today
                              ? 'today'
                              : 'yesterday'
                    }
                    options={[
                        ['today', 'Hoy'],
                        ['yesterday', 'Ayer'],
                        ['other', 'Otro día'],
                    ]}
                    onChange={(value) => {
                        setOtherDay(value === 'other');

                        if (value === 'today') {
                            setDate(data.today);
                        } else if (value === 'yesterday') {
                            setDate(yesterday(data.today));
                        }
                    }}
                />
                {otherDay && (
                    <Input
                        type="date"
                        aria-label="Fecha"
                        value={date}
                        max={data.today}
                        onChange={(event) => setDate(event.target.value)}
                    />
                )}
                <InputError message={errors.occurred_on} />
            </div>

            {accountsForKind.length > 1 && (
                <Chips
                    label={
                        isExpense ? '¿Con qué pagaste?' : '¿Dónde lo recibiste?'
                    }
                    value={accountId}
                    options={accountsForKind.map(
                        (a) => [a.id, a.name] as const,
                    )}
                    onChange={(value) => setAccountId(value)}
                />
            )}

            {isExpense && (
                <Chips
                    label="¿Qué fue? (opcional)"
                    value={spendingType}
                    options={SPENDING_TYPES}
                    onChange={setSpendingType}
                    allowEmpty
                />
            )}

            {showNotes ? (
                <div className="grid gap-2">
                    <Label htmlFor="quick-notes">Nota</Label>
                    <Input
                        id="quick-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        maxLength={2000}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="justify-self-start text-sm text-primary underline-offset-4 hover:underline"
                    onClick={() => setShowNotes(true)}
                >
                    Añadir una nota
                </button>
            )}

            <InputError message={errors.transaction ?? errors.kind} />

            <DialogFooter>
                <Button
                    type="submit"
                    size="lg"
                    disabled={saving || numeric === null || numeric <= 0}
                    className="h-12 text-base"
                >
                    {saving && <Spinner />}
                    Guardar
                </Button>
            </DialogFooter>
        </form>
    );
}

/**
 * «Guardar en mis ahorros»: mover dinero a la cuenta de ahorro (o sacarlo).
 * No es un gasto: el dinero sigue siendo tuyo.
 */
function QuickSavings({
    data,
    reload,
}: {
    data: QuickData;
    reload: () => void;
}) {
    const format = useFormat();
    const savings = data.accounts.find((a) => a.savings);
    const spendable = data.accounts.filter((a) => !a.savings);
    const [direction, setDirection] = useState<'in' | 'out'>('in');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState<number | null>(
        spendable[0]?.id ?? null,
    );
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const normalized = normalizeAmount(
        amount,
        format.preferences.number_locale,
    );
    const valid = /^\d+(\.\d+)?$/.test(normalized) && Number(normalized) > 0;

    if (!savings) {
        return (
            <form
                className="grid gap-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    setSaving(true);
                    router.post(
                        AccountController.store.url(),
                        {
                            name: 'Ahorros',
                            type: 'savings',
                            initial_balance: valid ? normalized : '0',
                        },
                        {
                            preserveScroll: true,
                            onSuccess: () => {
                                setAmount('');
                                reload();
                            },
                            onError: (e) => setErrors(e),
                            onFinish: () => setSaving(false),
                        },
                    );
                }}
            >
                <DialogTitle className="text-xl">Mis ahorros</DialogTitle>
                <DialogDescription>
                    Crea un sitio para el dinero que vas guardando. No cuenta
                    como dinero para gastar, pero sigue siendo tuyo.
                </DialogDescription>
                <AmountField
                    id="savings-initial"
                    label="¿Cuánto tienes ya ahorrado? (puede ser 0)"
                    value={amount}
                    onChange={setAmount}
                    error={errors.initial_balance ?? errors.name}
                />
                <DialogFooter>
                    <Button
                        type="submit"
                        size="lg"
                        className="h-12 text-base"
                        disabled={saving}
                    >
                        {saving && <Spinner />}
                        Crear mis ahorros
                    </Button>
                </DialogFooter>
            </form>
        );
    }

    return (
        <form
            className="grid gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                setSaving(true);
                router.post(
                    TransferController.store.url(),
                    {
                        from_account_id:
                            direction === 'in' ? accountId : savings.id,
                        to_account_id:
                            direction === 'in' ? savings.id : accountId,
                        amount: normalized,
                        occurred_on: data.today,
                        status: 'confirmed',
                        concept:
                            direction === 'in'
                                ? 'Guardado en ahorros'
                                : 'Sacado de ahorros',
                    },
                    {
                        preserveScroll: true,
                        onSuccess: () => closeQuick(),
                        onError: (e) => setErrors(e),
                        onFinish: () => setSaving(false),
                    },
                );
            }}
        >
            <DialogTitle className="text-xl">Mis ahorros</DialogTitle>
            <DialogDescription>
                Tienes {format.money(savings.balance)} ahorrados. Mover dinero
                aquí no es un gasto: sigue siendo tuyo.
            </DialogDescription>

            <Chips
                label="¿Qué quieres hacer?"
                value={direction}
                options={[
                    ['in', 'Guardar dinero'],
                    ['out', 'Sacar dinero'],
                ]}
                onChange={(value) => value && setDirection(value)}
            />

            <AmountField
                id="savings-amount"
                label="¿Cuánto?"
                value={amount}
                onChange={setAmount}
                error={errors.amount}
            />

            {spendable.length > 1 && (
                <Chips
                    label={
                        direction === 'in' ? '¿De dónde sale?' : '¿A dónde va?'
                    }
                    value={accountId}
                    options={spendable.map((a) => [a.id, a.name] as const)}
                    onChange={(value) => setAccountId(value)}
                />
            )}

            <InputError
                message={errors.to_account_id ?? errors.from_account_id}
            />

            <DialogFooter>
                <Button
                    type="submit"
                    size="lg"
                    className="h-12 text-base"
                    disabled={saving || !valid || accountId === null}
                >
                    {saving && <Spinner />}
                    {direction === 'in'
                        ? 'Guardar en ahorros'
                        : 'Sacar de ahorros'}
                </Button>
            </DialogFooter>
        </form>
    );
}

function QuickMenu() {
    const actions = [
        {
            key: 'expense',
            title: 'Gasté dinero',
            hint: 'Una compra, una cerveza, la gasolina…',
            icon: ShoppingBag,
        },
        {
            key: 'income',
            title: 'Me entró dinero',
            hint: 'El sueldo, una devolución, algo que vendiste…',
            icon: Wallet,
        },
        {
            key: 'savings',
            title: 'Mis ahorros',
            hint: 'Guardar o sacar dinero de tu hucha',
            icon: PiggyBank,
        },
    ] as const;

    return (
        <div className="grid gap-4">
            <DialogTitle className="text-xl">¿Qué quieres apuntar?</DialogTitle>
            <DialogDescription className="sr-only">
                Elige qué quieres apuntar.
            </DialogDescription>
            <ul className="grid gap-2">
                {actions.map(({ key, title, hint, icon: Icon }) => (
                    <li key={key}>
                        <button
                            type="button"
                            onClick={() => openQuick(key)}
                            className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="size-5" aria-hidden="true" />
                            </span>
                            <span>
                                <span className="block font-medium">
                                    {title}
                                </span>
                                <span className="block text-sm text-muted-foreground">
                                    {hint}
                                </span>
                            </span>
                        </button>
                    </li>
                ))}
                <li>
                    <Link
                        href={paymentsIndex()}
                        onClick={() => closeQuick()}
                        className="flex w-full items-center gap-4 rounded-2xl border p-4 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CalendarCheck
                                className="size-5"
                                aria-hidden="true"
                            />
                        </span>
                        <span>
                            <span className="block font-medium">
                                Pagué algo de mis pagos o una cuota
                            </span>
                            <span className="block text-sm text-muted-foreground">
                                El alquiler, la luz, la cuota del portátil…
                            </span>
                        </span>
                    </Link>
                </li>
            </ul>
        </div>
    );
}

/** Panel único del botón «+», montado en el layout de la app. */
export function QuickAddHost() {
    const view = useQuickView();
    const { data, reload } = useQuickData(view !== null && view !== 'menu');

    return (
        <Dialog
            open={view !== null}
            onOpenChange={(open) => !open && closeQuick()}
        >
            <DialogContent>
                {view === 'menu' && <QuickMenu />}
                {view !== null && view !== 'menu' && !data && (
                    <div className="grid gap-4" aria-busy="true">
                        <DialogTitle className="sr-only">Cargando</DialogTitle>
                        <DialogDescription className="sr-only">
                            Preparando el formulario.
                        </DialogDescription>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                )}
                {(view === 'expense' || view === 'income') && data && (
                    <QuickEntry key={view} kind={view} data={data} />
                )}
                {view === 'savings' && data && (
                    <QuickSavings data={data} reload={reload} />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Accesos directos reutilizables (inicio, cabeceras). */
export function QuickButtons({ className }: { className?: string }) {
    return (
        <div className={cn('grid grid-cols-2 gap-2', className)}>
            <Button
                size="lg"
                className="h-14 justify-start gap-3 rounded-2xl bg-expense-soft text-base text-expense shadow-none hover:bg-expense-soft/80"
                onClick={() => openQuick('expense')}
            >
                <ArrowUpFromLine aria-hidden="true" />
                Gasté dinero
            </Button>
            <Button
                size="lg"
                className="h-14 justify-start gap-3 rounded-2xl bg-income-soft text-base text-income shadow-none hover:bg-income-soft/80"
                onClick={() => openQuick('income')}
            >
                <ArrowDownToLine aria-hidden="true" />
                Me entró dinero
            </Button>
        </div>
    );
}
