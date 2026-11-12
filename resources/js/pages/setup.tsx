import { Head, router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import AppLogo from '@/components/app-logo';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { normalizeAmount } from '@/lib/amount';
import { cn } from '@/lib/utils';
import { fromMinor, toMinor } from '@/offline/money';
import {
    debts as setupDebts,
    finish as setupFinish,
    incomes as setupIncomes,
    money as setupMoney,
    payments as setupPayments,
    show as setupShow,
} from '@/routes/setup';

type Step = 'dinero' | 'ingresos' | 'pagos' | 'deudas' | 'resumen';
const STEPS: Step[] = ['dinero', 'ingresos', 'pagos', 'deudas', 'resumen'];

type RuleSummary = {
    id: number;
    concept: string;
    amount: string;
    frequency: string;
    frequency_label: string;
    variable: boolean;
};

type Props = {
    step: string;
    accounts: { id: number; name: string; type: string; balance: string }[];
    incomes: RuleSummary[];
    payments: RuleSummary[];
    debts: {
        id: number;
        concept: string;
        outstanding: string;
        installment: string | null;
        frequency: string | null;
    }[];
    currency: string;
    today: string;
};

type Errors = Record<string, string>;

/** Veces al mes de cada frecuencia, como fracción (numerador, denominador). */
const PER_MONTH: Record<string, [number, number]> = {
    weekly: [52, 12],
    biweekly: [26, 12],
    monthly: [1, 1],
    bimonthly: [1, 2],
    quarterly: [1, 3],
    semiannual: [1, 6],
    yearly: [1, 12],
};

const RULE_FREQUENCIES = [
    ['monthly', 'Cada mes'],
    ['biweekly', 'Cada 2 semanas'],
    ['weekly', 'Cada semana'],
    ['bimonthly', 'Cada 2 meses'],
    ['quarterly', 'Cada 3 meses'],
    ['yearly', 'Cada año'],
] as const;

const PAYMENT_IDEAS = [
    'Alquiler',
    'Hipoteca',
    'Luz',
    'Agua',
    'Internet',
    'Teléfono',
    'Gimnasio',
    'Suscripciones',
    'Seguro',
];

/** Próxima fecha con ese día del mes (el último día si el mes es corto). */
function nextDay(today: string, day: number): string {
    const [y, m, d] = today.split('-').map(Number);
    const build = (year: number, month: number) => {
        const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

        return new Date(Date.UTC(year, month, Math.min(day, last)));
    };
    let date = build(y, m - 1);

    if (date.getUTCDate() < d && date.getUTCMonth() === m - 1) {
        date = build(y, m);
    }

    return date.toISOString().slice(0, 10);
}

function Question({
    number,
    title,
    help,
    children,
}: {
    number?: number;
    title: string;
    help?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-6">
            <div className="space-y-2">
                {number && (
                    <p className="text-sm font-medium text-primary">
                        Pregunta {number} de 4
                    </p>
                )}
                <h1 className="text-2xl font-semibold text-balance sm:text-3xl">
                    {title}
                </h1>
                {help && <p className="text-muted-foreground">{help}</p>}
            </div>
            {children}
        </section>
    );
}

function Footer({
    onNext,
    onSkip,
    nextLabel = 'Siguiente',
    saving,
}: {
    onNext: () => void;
    onSkip?: () => void;
    nextLabel?: string;
    saving: boolean;
}) {
    return (
        <div className="sticky bottom-0 -mx-4 mt-8 flex flex-col-reverse gap-2 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0">
            {onSkip && (
                <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={onSkip}
                >
                    Saltar esta pregunta
                </Button>
            )}
            <Button
                type="button"
                size="lg"
                className="h-12 text-base"
                onClick={onNext}
                disabled={saving}
            >
                {saving && <Spinner />}
                {nextLabel}
            </Button>
        </div>
    );
}

function MoneyInput({
    id,
    label,
    value,
    onChange,
    error,
    hint,
    big = false,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    hint?: string;
    big?: boolean;
}) {
    const format = useFormat();

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="0"
                    className={cn(
                        'pr-12 tabular-nums',
                        big && 'h-14 text-2xl font-semibold md:text-2xl',
                    )}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    {format.preferences.currency}
                </span>
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <InputError message={error} />
        </div>
    );
}

function DayOrDate({
    frequency,
    day,
    date,
    onDay,
    onDate,
    idPrefix,
    label,
}: {
    frequency: string;
    day: number;
    date: string;
    onDay: (day: number) => void;
    onDate: (date: string) => void;
    idPrefix: string;
    label: string;
}) {
    if (frequency === 'monthly') {
        return (
            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-day`}>{label}</Label>
                <NativeSelect
                    id={`${idPrefix}-day`}
                    value={day}
                    onChange={(event) => onDay(Number(event.target.value))}
                >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                            El día {d}
                        </option>
                    ))}
                </NativeSelect>
            </div>
        );
    }

    return (
        <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-date`}>
                ¿Cuándo toca la próxima vez?
            </Label>
            <Input
                id={`${idPrefix}-date`}
                type="date"
                value={date}
                onChange={(event) => onDate(event.target.value)}
            />
        </div>
    );
}

type RuleRow = {
    key: number;
    concept: string;
    amount: string;
    frequency: string;
    day: number;
    date: string;
    variable: boolean;
};

export default function Setup(props: Props) {
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const decimals = format.preferences.currency_decimals ?? 2;
    const step: Step = STEPS.includes(props.step as Step)
        ? (props.step as Step)
        : 'dinero';
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);

    const go = (next: Step) =>
        router.get(
            setupShow({ query: { paso: next } }),
            {},
            { preserveScroll: false },
        );
    const submit = (url: string, data: Record<string, unknown>) => {
        setSaving(true);
        setErrors({});
        router.post(url, data as never, {
            onError: (e) => setErrors(e),
            onFinish: () => setSaving(false),
        });
    };
    const finish = () => submit(setupFinish().url, {});
    const amount = (value: string) =>
        value.trim() === '' ? null : normalizeAmount(value, locale);

    // Paso 1: dinero de hoy.
    const has = (type: string) => props.accounts.some((a) => a.type === type);
    const [bank, setBank] = useState('');
    const [cash, setCash] = useState('');
    const [savings, setSavings] = useState('');
    const [withCash, setWithCash] = useState(false);
    const [withSavings, setWithSavings] = useState(false);

    // Pasos 2 y 3: cobros y pagos habituales.
    const [incomeMode, setIncomeMode] = useState<
        'fixed' | 'variable' | 'none' | null
    >(props.incomes.length > 0 ? 'fixed' : null);
    const newRow = (concept = ''): RuleRow => ({
        key: Math.random(),
        concept,
        amount: '',
        frequency: 'monthly',
        day: 1,
        date: props.today,
        variable: false,
    });
    const [incomeRows, setIncomeRows] = useState<RuleRow[]>(() =>
        props.incomes.length > 0 ? [] : [newRow('Sueldo')],
    );
    const [paymentRows, setPaymentRows] = useState<RuleRow[]>([]);

    const ruleItems = (rows: RuleRow[], variable = false) =>
        rows
            .filter(
                (row) => row.concept.trim() !== '' || row.amount.trim() !== '',
            )
            .map((row) => ({
                concept: row.concept.trim(),
                amount: amount(row.amount),
                frequency: row.frequency,
                next_on:
                    row.frequency === 'monthly'
                        ? nextDay(props.today, row.day)
                        : row.date,
                variable: variable || row.variable,
            }));

    // Paso 4: deudas.
    type DebtRow = {
        key: number;
        concept: string;
        total: string;
        installment: string;
        frequency: string;
        paid_installments: string;
        next_due_on: string;
        creditor: string;
    };
    const newDebt = (): DebtRow => ({
        key: Math.random(),
        concept: '',
        total: '',
        installment: '',
        frequency: 'monthly',
        paid_installments: '',
        next_due_on: '',
        creditor: '',
    });
    const [hasDebts, setHasDebts] = useState<boolean | null>(
        props.debts.length > 0 ? true : null,
    );
    const [debtRows, setDebtRows] = useState<DebtRow[]>([]);

    const updateRow = <T extends { key: number }>(
        setter: React.Dispatch<React.SetStateAction<T[]>>,
        key: number,
        changes: Partial<T>,
    ) =>
        setter((rows) =>
            rows.map((row) => (row.key === key ? { ...row, ...changes } : row)),
        );

    // Resumen (estimación mensual con céntimos enteros).
    const monthly = (rules: RuleSummary[]) =>
        rules.reduce((sum, rule) => {
            const [num, den] = PER_MONTH[rule.frequency] ?? [1, 1];

            return (
                sum + Math.round((toMinor(rule.amount, decimals) * num) / den)
            );
        }, 0);
    const available = props.accounts
        .filter((a) => a.type !== 'savings')
        .reduce((sum, a) => sum + toMinor(a.balance, decimals), 0);
    const saved = props.accounts
        .filter((a) => a.type === 'savings')
        .reduce((sum, a) => sum + toMinor(a.balance, decimals), 0);
    const income = monthly(props.incomes);
    const fixed = monthly(props.payments);
    const installments = props.debts.reduce((sum, d) => {
        if (!d.installment || !d.frequency) {
            return sum;
        }

        const [num, den] = PER_MONTH[d.frequency] ?? [1, 1];

        return sum + Math.round((toMinor(d.installment, decimals) * num) / den);
    }, 0);
    const owed = props.debts.reduce(
        (sum, d) => sum + toMinor(d.outstanding, decimals),
        0,
    );
    const free = income - fixed - installments;
    const money = (minor: number) =>
        format.money(fromMinor(minor, decimals) as `${number}`);

    const index = STEPS.indexOf(step);

    return (
        <div className="min-h-svh bg-background">
            <Head title="Primeros pasos" />

            <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
                <AppLogo />
                {step !== 'resumen' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={finish}
                        disabled={saving}
                    >
                        Lo haré más tarde
                    </Button>
                )}
            </header>

            <div className="mx-auto max-w-2xl px-4">
                <div
                    className="mb-8 flex gap-1.5"
                    role="progressbar"
                    aria-label="Progreso"
                    aria-valuemin={1}
                    aria-valuemax={STEPS.length}
                    aria-valuenow={index + 1}
                >
                    {STEPS.map((s, i) => (
                        <span
                            key={s}
                            className={cn(
                                'h-1.5 flex-1 rounded-full',
                                i <= index ? 'bg-primary' : 'bg-muted',
                            )}
                        />
                    ))}
                </div>

                {step === 'dinero' && (
                    <Question
                        number={1}
                        title="¿Cuánto dinero tienes ahora?"
                        help="Lo que hay en tu cuenta del banco hoy. Es tu punto de partida: no cuenta como un ingreso."
                    >
                        {props.accounts.length > 0 && (
                            <div className="rounded-xl bg-muted/60 p-4 text-sm">
                                Ya tienes apuntado:{' '}
                                {props.accounts
                                    .map(
                                        (a) =>
                                            `${a.name} (${format.money(a.balance)})`,
                                    )
                                    .join(', ')}
                                .
                            </div>
                        )}

                        {!has('bank') && (
                            <MoneyInput
                                id="bank"
                                label="En el banco"
                                value={bank}
                                onChange={setBank}
                                error={errors.bank}
                                big
                            />
                        )}

                        {!has('cash') &&
                            (withCash ? (
                                <MoneyInput
                                    id="cash"
                                    label="En efectivo (en la cartera, en casa…)"
                                    value={cash}
                                    onChange={setCash}
                                    error={errors.cash}
                                />
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => setWithCash(true)}
                                >
                                    <Plus aria-hidden="true" />
                                    También tengo efectivo
                                </Button>
                            ))}

                        {!has('savings') &&
                            (withSavings ? (
                                <MoneyInput
                                    id="savings"
                                    label="Ahorrado aparte (una cuenta de ahorro, una hucha…)"
                                    value={savings}
                                    onChange={setSavings}
                                    error={errors.savings}
                                    hint="Lo verás separado de tu dinero para gastar."
                                />
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => setWithSavings(true)}
                                >
                                    <Plus aria-hidden="true" />
                                    Tengo dinero ahorrado aparte
                                </Button>
                            ))}

                        <Footer
                            saving={saving}
                            onSkip={() => go('ingresos')}
                            onNext={() =>
                                submit(setupMoney().url, {
                                    bank: amount(bank),
                                    cash: amount(cash),
                                    savings: amount(savings),
                                })
                            }
                        />
                    </Question>
                )}

                {step === 'ingresos' && (
                    <Question
                        number={2}
                        title="¿Cuánto cobras normalmente?"
                        help="Te recordaremos cuándo llega. No se suma a tu dinero hasta que nos digas que lo has cobrado."
                    >
                        {props.incomes.length > 0 && (
                            <div className="rounded-xl bg-muted/60 p-4 text-sm">
                                Ya tienes apuntado:{' '}
                                {props.incomes
                                    .map(
                                        (r) =>
                                            `${r.concept} (${format.money(r.amount)}, ${r.frequency_label.toLowerCase()})`,
                                    )
                                    .join(', ')}
                                .
                            </div>
                        )}

                        <div className="grid gap-2 sm:grid-cols-3">
                            {(
                                [
                                    ['fixed', 'Tengo un sueldo fijo'],
                                    ['variable', 'Cobro cantidades que varían'],
                                    ['none', 'No tengo ingresos fijos'],
                                ] as const
                            ).map(([mode, label]) => (
                                <button
                                    key={mode}
                                    type="button"
                                    aria-pressed={incomeMode === mode}
                                    onClick={() => setIncomeMode(mode)}
                                    className={cn(
                                        'min-h-12 rounded-xl border p-3 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                        incomeMode === mode
                                            ? 'border-primary bg-primary/5'
                                            : 'hover:bg-muted',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {(incomeMode === 'fixed' ||
                            incomeMode === 'variable') && (
                            <div className="grid gap-4">
                                {incomeRows.map((row, i) => (
                                    <div
                                        key={row.key}
                                        className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2"
                                    >
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`inc-${row.key}-concept`}
                                            >
                                                ¿Qué es?
                                            </Label>
                                            <Input
                                                id={`inc-${row.key}-concept`}
                                                value={row.concept}
                                                onChange={(e) =>
                                                    updateRow(
                                                        setIncomeRows,
                                                        row.key,
                                                        {
                                                            concept:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                                placeholder="Sueldo"
                                            />
                                            <InputError
                                                message={
                                                    errors[`items.${i}.concept`]
                                                }
                                            />
                                        </div>
                                        <MoneyInput
                                            id={`inc-${row.key}-amount`}
                                            label={
                                                incomeMode === 'variable'
                                                    ? '¿Cuánto, más o menos?'
                                                    : '¿Cuánto?'
                                            }
                                            value={row.amount}
                                            onChange={(value) =>
                                                updateRow(
                                                    setIncomeRows,
                                                    row.key,
                                                    { amount: value },
                                                )
                                            }
                                            error={errors[`items.${i}.amount`]}
                                        />
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`inc-${row.key}-freq`}
                                            >
                                                ¿Cada cuánto?
                                            </Label>
                                            <NativeSelect
                                                id={`inc-${row.key}-freq`}
                                                value={row.frequency}
                                                onChange={(e) =>
                                                    updateRow(
                                                        setIncomeRows,
                                                        row.key,
                                                        {
                                                            frequency:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            >
                                                {RULE_FREQUENCIES.slice(
                                                    0,
                                                    3,
                                                ).map(([value, label]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </option>
                                                ))}
                                            </NativeSelect>
                                        </div>
                                        <DayOrDate
                                            idPrefix={`inc-${row.key}`}
                                            label="¿Qué día te pagan normalmente?"
                                            frequency={row.frequency}
                                            day={row.day}
                                            date={row.date}
                                            onDay={(day) =>
                                                updateRow(
                                                    setIncomeRows,
                                                    row.key,
                                                    { day },
                                                )
                                            }
                                            onDate={(date) =>
                                                updateRow(
                                                    setIncomeRows,
                                                    row.key,
                                                    { date },
                                                )
                                            }
                                        />
                                        {incomeRows.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="justify-self-start"
                                                onClick={() =>
                                                    setIncomeRows((rows) =>
                                                        rows.filter(
                                                            (r) =>
                                                                r.key !==
                                                                row.key,
                                                        ),
                                                    )
                                                }
                                            >
                                                <Trash2 aria-hidden="true" />
                                                Quitar
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="justify-self-start"
                                    onClick={() =>
                                        setIncomeRows((rows) => [
                                            ...rows,
                                            newRow(),
                                        ])
                                    }
                                >
                                    <Plus aria-hidden="true" />
                                    Añadir otro ingreso
                                </Button>
                            </div>
                        )}

                        {incomeMode === 'none' && (
                            <p className="rounded-xl bg-muted/60 p-4 text-sm">
                                Sin problema. Cada vez que te entre dinero,
                                pulsa «Me entró dinero» y lo apuntamos.
                            </p>
                        )}

                        <InputError message={errors.items} />

                        <Footer
                            saving={saving}
                            onSkip={() => go('pagos')}
                            onNext={() =>
                                incomeMode === 'fixed' ||
                                incomeMode === 'variable'
                                    ? submit(setupIncomes().url, {
                                          items: ruleItems(
                                              incomeRows,
                                              incomeMode === 'variable',
                                          ),
                                      })
                                    : go('pagos')
                            }
                        />
                    </Question>
                )}

                {step === 'pagos' && (
                    <Question
                        number={3}
                        title="¿Qué cosas pagas habitualmente?"
                        help="Toca las que tengas y pon cuánto y qué día. Nada se descuenta hasta que nos digas «Ya lo pagué»."
                    >
                        {props.payments.length > 0 && (
                            <div className="rounded-xl bg-muted/60 p-4 text-sm">
                                Ya tienes apuntado:{' '}
                                {props.payments
                                    .map((r) => r.concept)
                                    .join(', ')}
                                .
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {PAYMENT_IDEAS.filter(
                                (idea) =>
                                    !paymentRows.some(
                                        (row) => row.concept === idea,
                                    ),
                            ).map((idea) => (
                                <button
                                    key={idea}
                                    type="button"
                                    onClick={() =>
                                        setPaymentRows((rows) => [
                                            ...rows,
                                            {
                                                ...newRow(idea),
                                                variable: [
                                                    'Luz',
                                                    'Agua',
                                                ].includes(idea),
                                            },
                                        ])
                                    }
                                    className="min-h-10 rounded-full border px-4 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    + {idea}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() =>
                                    setPaymentRows((rows) => [
                                        ...rows,
                                        newRow(),
                                    ])
                                }
                                className="min-h-10 rounded-full border border-dashed px-4 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                + Otro
                            </button>
                        </div>

                        <div className="grid gap-3">
                            {paymentRows.map((row, i) => (
                                <div
                                    key={row.key}
                                    className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2"
                                >
                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor={`pay-${row.key}-concept`}
                                        >
                                            ¿Qué es?
                                        </Label>
                                        <Input
                                            id={`pay-${row.key}-concept`}
                                            value={row.concept}
                                            onChange={(e) =>
                                                updateRow(
                                                    setPaymentRows,
                                                    row.key,
                                                    { concept: e.target.value },
                                                )
                                            }
                                        />
                                        <InputError
                                            message={
                                                errors[`items.${i}.concept`]
                                            }
                                        />
                                    </div>
                                    <MoneyInput
                                        id={`pay-${row.key}-amount`}
                                        label={
                                            row.variable
                                                ? '¿Cuánto, más o menos?'
                                                : '¿Cuánto?'
                                        }
                                        value={row.amount}
                                        onChange={(value) =>
                                            updateRow(setPaymentRows, row.key, {
                                                amount: value,
                                            })
                                        }
                                        error={errors[`items.${i}.amount`]}
                                    />
                                    <div className="grid gap-2">
                                        <Label htmlFor={`pay-${row.key}-freq`}>
                                            ¿Cada cuánto?
                                        </Label>
                                        <NativeSelect
                                            id={`pay-${row.key}-freq`}
                                            value={row.frequency}
                                            onChange={(e) =>
                                                updateRow(
                                                    setPaymentRows,
                                                    row.key,
                                                    {
                                                        frequency:
                                                            e.target.value,
                                                    },
                                                )
                                            }
                                        >
                                            {RULE_FREQUENCIES.map(
                                                ([value, label]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </option>
                                                ),
                                            )}
                                        </NativeSelect>
                                    </div>
                                    <DayOrDate
                                        idPrefix={`pay-${row.key}`}
                                        label="¿Qué día lo pagas?"
                                        frequency={row.frequency}
                                        day={row.day}
                                        date={row.date}
                                        onDay={(day) =>
                                            updateRow(setPaymentRows, row.key, {
                                                day,
                                            })
                                        }
                                        onDate={(date) =>
                                            updateRow(setPaymentRows, row.key, {
                                                date,
                                            })
                                        }
                                    />
                                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                                        <input
                                            type="checkbox"
                                            className="size-4 accent-primary"
                                            checked={row.variable}
                                            onChange={(e) =>
                                                updateRow(
                                                    setPaymentRows,
                                                    row.key,
                                                    {
                                                        variable:
                                                            e.target.checked,
                                                    },
                                                )
                                            }
                                        />
                                        El importe cambia cada vez (como la luz)
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="justify-self-start"
                                        onClick={() =>
                                            setPaymentRows((rows) =>
                                                rows.filter(
                                                    (r) => r.key !== row.key,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2 aria-hidden="true" />
                                        Quitar
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <InputError message={errors.items} />

                        <Footer
                            saving={saving}
                            onSkip={() => go('deudas')}
                            onNext={() =>
                                paymentRows.length > 0
                                    ? submit(setupPayments().url, {
                                          items: ruleItems(paymentRows),
                                      })
                                    : go('deudas')
                            }
                        />
                    </Question>
                )}

                {step === 'deudas' && (
                    <Question
                        number={4}
                        title="¿Tienes alguna deuda o compra a cuotas?"
                        help="Un préstamo, algo comprado a plazos, la tarjeta o dinero que te dejó alguien. Apuntarla no cuenta como gasto."
                    >
                        {props.debts.length > 0 && (
                            <div className="rounded-xl bg-muted/60 p-4 text-sm">
                                Ya tienes apuntado:{' '}
                                {props.debts.map((d) => d.concept).join(', ')}.
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            {(
                                [
                                    [true, 'Sí'],
                                    [false, 'No, no debo nada'],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={label}
                                    type="button"
                                    aria-pressed={hasDebts === value}
                                    onClick={() => {
                                        setHasDebts(value);

                                        if (value && debtRows.length === 0) {
                                            setDebtRows([newDebt()]);
                                        }
                                    }}
                                    className={cn(
                                        'min-h-12 rounded-xl border p-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                        hasDebts === value
                                            ? 'border-primary bg-primary/5'
                                            : 'hover:bg-muted',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {hasDebts && (
                            <div className="grid gap-4">
                                {debtRows.map((row, i) => (
                                    <div
                                        key={row.key}
                                        className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2"
                                    >
                                        <div className="grid gap-2 sm:col-span-2">
                                            <Label
                                                htmlFor={`debt-${row.key}-concept`}
                                            >
                                                ¿Qué es?
                                            </Label>
                                            <Input
                                                id={`debt-${row.key}-concept`}
                                                value={row.concept}
                                                placeholder="Ej.: Portátil, préstamo de Juan"
                                                onChange={(e) =>
                                                    updateRow(
                                                        setDebtRows,
                                                        row.key,
                                                        {
                                                            concept:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errors[`items.${i}.concept`]
                                                }
                                            />
                                        </div>
                                        <MoneyInput
                                            id={`debt-${row.key}-total`}
                                            label="¿Cuánto debías en total?"
                                            value={row.total}
                                            onChange={(value) =>
                                                updateRow(
                                                    setDebtRows,
                                                    row.key,
                                                    { total: value },
                                                )
                                            }
                                            error={errors[`items.${i}.total`]}
                                        />
                                        <MoneyInput
                                            id={`debt-${row.key}-installment`}
                                            label="¿Cuánto pagas por cuota? (si hay)"
                                            value={row.installment}
                                            onChange={(value) =>
                                                updateRow(
                                                    setDebtRows,
                                                    row.key,
                                                    { installment: value },
                                                )
                                            }
                                            error={
                                                errors[`items.${i}.installment`]
                                            }
                                        />
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`debt-${row.key}-freq`}
                                            >
                                                ¿Cada cuánto?
                                            </Label>
                                            <NativeSelect
                                                id={`debt-${row.key}-freq`}
                                                value={row.frequency}
                                                onChange={(e) =>
                                                    updateRow(
                                                        setDebtRows,
                                                        row.key,
                                                        {
                                                            frequency:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            >
                                                {RULE_FREQUENCIES.map(
                                                    ([value, label]) => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {label}
                                                        </option>
                                                    ),
                                                )}
                                            </NativeSelect>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`debt-${row.key}-paid`}
                                            >
                                                ¿Cuántas cuotas has pagado ya?
                                            </Label>
                                            <Input
                                                id={`debt-${row.key}-paid`}
                                                type="number"
                                                min={0}
                                                inputMode="numeric"
                                                value={row.paid_installments}
                                                onChange={(e) =>
                                                    updateRow(
                                                        setDebtRows,
                                                        row.key,
                                                        {
                                                            paid_installments:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                                placeholder="0"
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `items.${i}.paid_amount`
                                                    ]
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`debt-${row.key}-next`}
                                            >
                                                ¿Cuándo toca la próxima?
                                            </Label>
                                            <Input
                                                id={`debt-${row.key}-next`}
                                                type="date"
                                                value={row.next_due_on}
                                                onChange={(e) =>
                                                    updateRow(
                                                        setDebtRows,
                                                        row.key,
                                                        {
                                                            next_due_on:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`debt-${row.key}-creditor`}
                                            >
                                                ¿A quién? (opcional)
                                            </Label>
                                            <Input
                                                id={`debt-${row.key}-creditor`}
                                                value={row.creditor}
                                                onChange={(e) =>
                                                    updateRow(
                                                        setDebtRows,
                                                        row.key,
                                                        {
                                                            creditor:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="justify-self-start"
                                    onClick={() =>
                                        setDebtRows((rows) => [
                                            ...rows,
                                            newDebt(),
                                        ])
                                    }
                                >
                                    <Plus aria-hidden="true" />
                                    Añadir otra deuda
                                </Button>
                            </div>
                        )}

                        <Footer
                            saving={saving}
                            onSkip={() => go('resumen')}
                            onNext={() =>
                                hasDebts && debtRows.length > 0
                                    ? submit(setupDebts().url, {
                                          items: debtRows.map((row) => ({
                                              concept: row.concept.trim(),
                                              creditor:
                                                  row.creditor.trim() || null,
                                              total: amount(row.total),
                                              installment: amount(
                                                  row.installment,
                                              ),
                                              frequency: row.frequency,
                                              paid_installments:
                                                  row.paid_installments === ''
                                                      ? null
                                                      : Number(
                                                            row.paid_installments,
                                                        ),
                                              next_due_on:
                                                  row.next_due_on || null,
                                          })),
                                      })
                                    : go('resumen')
                            }
                        />
                    </Question>
                )}

                {step === 'resumen' && (
                    <Question title="Así está tu dinero">
                        <dl className="grid gap-3">
                            <div className="rounded-2xl border p-4">
                                <dt className="text-sm text-muted-foreground">
                                    Tienes para gastar
                                </dt>
                                <dd className="text-3xl font-semibold tabular-nums">
                                    {money(available)}
                                </dd>
                                {saved !== 0 && (
                                    <dd className="text-sm text-muted-foreground">
                                        Y {money(saved)} ahorrados aparte.
                                    </dd>
                                )}
                            </div>
                            {income > 0 && (
                                <div className="rounded-2xl border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Cobras al mes, más o menos
                                    </dt>
                                    <dd className="text-2xl font-semibold tabular-nums">
                                        {money(income)}
                                    </dd>
                                </div>
                            )}
                            {fixed > 0 && (
                                <div className="rounded-2xl border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        En pagos de cada mes se te van
                                    </dt>
                                    <dd className="text-2xl font-semibold tabular-nums">
                                        {money(fixed)}
                                    </dd>
                                </div>
                            )}
                            {owed > 0 && (
                                <div className="rounded-2xl border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Te falta por pagar de tus deudas
                                    </dt>
                                    <dd className="text-2xl font-semibold tabular-nums">
                                        {money(owed)}
                                    </dd>
                                    {installments > 0 && (
                                        <dd className="text-sm text-muted-foreground">
                                            Unos {money(installments)} al mes en
                                            cuotas.
                                        </dd>
                                    )}
                                </div>
                            )}
                            {income > 0 && (
                                <div
                                    className={cn(
                                        'rounded-2xl p-4',
                                        free >= 0
                                            ? 'bg-primary/10'
                                            : 'bg-muted',
                                    )}
                                >
                                    <dt className="text-sm text-muted-foreground">
                                        {free >= 0
                                            ? 'Después de tus pagos fijos y cuotas te quedan cada mes'
                                            : 'Tus pagos fijos y cuotas superan lo que cobras en'}
                                    </dt>
                                    <dd className="text-2xl font-semibold tabular-nums">
                                        {money(Math.abs(free))}
                                    </dd>
                                    <dd className="text-xs text-muted-foreground">
                                        Es una cuenta aproximada para el día a
                                        día; los gastos sueltos van aparte.
                                    </dd>
                                </div>
                            )}
                        </dl>

                        <p className="text-sm text-muted-foreground">
                            Puedes cambiar todo esto cuando quieras desde «Mis
                            pagos».
                        </p>

                        <Footer
                            saving={saving}
                            nextLabel="Ir a mi dinero"
                            onNext={finish}
                        />
                    </Question>
                )}
            </div>
        </div>
    );
}
