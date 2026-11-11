import { Form, Head } from '@inertiajs/react';
import {
    Ban,
    CalendarClock,
    CircleCheck,
    HandCoins,
    History,
    Pencil,
    Plus,
} from 'lucide-react';
import { useState } from 'react';
import DebtController from '@/actions/App/Http/Controllers/Finance/DebtController';
import AmountInput from '@/components/finance/amount-input';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { normalizeAmountFields } from '@/lib/amount';
import { index as debtsIndex } from '@/routes/debts';
import { newUuid } from '@/offline/storage';

type Payment = {
    id: number;
    paid_on: string;
    account: string;
    principal: string;
    interest: string;
    fees: string;
    total: string;
    notes: string | null;
    voided: boolean;
    void_reason: string | null;
};

type Debt = {
    id: number;
    creditor: string;
    concept: string;
    currency: string;
    principal: string;
    outstanding: string;
    repaid_percent: number;
    interest_paid: string;
    fees_paid: string;
    started_on: string;
    installment: string | null;
    frequency: string | null;
    frequency_label: string | null;
    next_due_on: string | null;
    interest_rate: string | null;
    notes: string | null;
    settled: boolean;
    has_payments: boolean;
    payments: Payment[];
};

type Option = { id: number; name: string };

type Props = {
    debts: Debt[];
    totalOutstanding: string;
    accounts: Option[];
    expenseCategories: Option[];
    defaultCategoryId: number | null;
    frequencies: { value: string; label: string }[];
    today: string;
};

type DialogState =
    | { type: 'debt'; debt: Debt | null }
    | { type: 'payment'; debt: Debt; settle: boolean }
    | { type: 'history'; debt: Debt }
    | { type: 'void'; payment: Payment }
    | null;

export default function DebtsIndex(props: Props) {
    const { debts, totalOutstanding } = props;
    const format = useFormat();
    const [dialog, setDialog] = useState<DialogState>(null);
    const active = debts.filter((debt) => !debt.settled);
    const settled = debts.filter((debt) => debt.settled);

    return (
        <>
            <Head title="Deudas" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Deudas"
                        description="Lo que debes, lo que has devuelto y los próximos vencimientos."
                    />
                    <Button
                        onClick={() => setDialog({ type: 'debt', debt: null })}
                    >
                        <Plus aria-hidden="true" />
                        Nueva deuda
                    </Button>
                </div>

                {active.length > 0 && (
                    <section
                        aria-label="Capital pendiente"
                        className="rounded-2xl border bg-card p-5 shadow-xs"
                    >
                        <p className="text-sm text-muted-foreground">
                            Capital pendiente de devolver
                        </p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums">
                            {format.money(totalOutstanding)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Solo el capital. Los intereses y comisiones se
                            registran como gasto cuando los pagas.
                        </p>
                    </section>
                )}

                {debts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                        <HandCoins
                            className="mx-auto mb-3 size-8 text-primary"
                            aria-hidden="true"
                        />
                        <h2 className="font-semibold">
                            No tienes deudas registradas
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            Si tienes un préstamo, un crédito o un pago
                            aplazado, añádelo para seguir lo que queda por
                            devolver y anticipar sus cuotas.
                        </p>
                    </div>
                ) : (
                    <ul className="grid gap-4 lg:grid-cols-2">
                        {[...active, ...settled].map((debt) => (
                            <DebtCard
                                key={debt.id}
                                debt={debt}
                                onEdit={() => setDialog({ type: 'debt', debt })}
                                onPay={(settle) =>
                                    setDialog({ type: 'payment', debt, settle })
                                }
                                onHistory={() =>
                                    setDialog({ type: 'history', debt })
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
                <DialogContent>
                    {dialog?.type === 'debt' && (
                        <DebtForm
                            {...props}
                            debt={dialog.debt}
                            onDone={() => setDialog(null)}
                        />
                    )}
                    {dialog?.type === 'payment' && (
                        <PaymentForm
                            {...props}
                            debt={dialog.debt}
                            settle={dialog.settle}
                            onDone={() => setDialog(null)}
                        />
                    )}
                    {dialog?.type === 'history' && (
                        <PaymentHistory
                            debt={dialog.debt}
                            onVoid={(payment) =>
                                setDialog({ type: 'void', payment })
                            }
                        />
                    )}
                    {dialog?.type === 'void' && (
                        <VoidPaymentForm
                            payment={dialog.payment}
                            onDone={() => setDialog(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function DebtCard({
    debt,
    onEdit,
    onPay,
    onHistory,
}: {
    debt: Debt;
    onEdit: () => void;
    onPay: (settle: boolean) => void;
    onHistory: () => void;
}) {
    const format = useFormat();

    return (
        <li className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="truncate font-semibold">{debt.creditor}</h2>
                    <p className="truncate text-sm text-muted-foreground">
                        {debt.concept}
                    </p>
                </div>
                {debt.settled ? (
                    <Badge variant="secondary">
                        <CircleCheck aria-hidden="true" />
                        Saldada
                    </Badge>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${debt.creditor}`}
                        onClick={onEdit}
                    >
                        <Pencil aria-hidden="true" />
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                        Pendiente
                    </span>
                    <span className="text-xl font-semibold tabular-nums">
                        {format.money(debt.outstanding, debt.currency)}
                    </span>
                </div>
                <ProgressBar
                    value={debt.repaid_percent}
                    label={`Devuelto de ${debt.creditor}`}
                    valueText={`${debt.repaid_percent} % devuelto`}
                    tone={debt.settled ? 'done' : 'default'}
                />
                <p className="text-xs text-muted-foreground">
                    {debt.repaid_percent} % devuelto de{' '}
                    {format.money(debt.principal, debt.currency)}
                </p>
            </div>

            {!debt.settled && (debt.next_due_on || debt.installment) && (
                <p className="flex items-center gap-2 text-sm">
                    <CalendarClock
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                    />
                    {debt.next_due_on && (
                        <>Próxima cuota: {format.day(debt.next_due_on)}</>
                    )}
                    {debt.installment && (
                        <span className="text-muted-foreground">
                            {' '}
                            · {format.money(debt.installment, debt.currency)}
                            {debt.frequency_label &&
                                ` (${debt.frequency_label.toLowerCase()})`}
                        </span>
                    )}
                </p>
            )}

            <div className="mt-auto flex flex-wrap gap-2">
                {!debt.settled && (
                    <>
                        <Button size="sm" onClick={() => onPay(false)}>
                            Registrar pago
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPay(true)}
                        >
                            Liquidar
                        </Button>
                    </>
                )}
                <Button size="sm" variant="ghost" onClick={onHistory}>
                    <History aria-hidden="true" />
                    Historial ({debt.payments.length})
                </Button>
            </div>
        </li>
    );
}

function DebtForm({
    debt,
    accounts,
    frequencies,
    today,
    onDone,
}: Props & { debt: Debt | null; onDone: () => void }) {
    const format = useFormat();
    const form = debt
        ? DebtController.update.form(debt.id)
        : DebtController.store.form();

    return (
        <Form
            {...form}
            transform={(data) =>
                normalizeAmountFields(
                    data,
                    ['principal', 'installment'],
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
                        {debt ? 'Editar deuda' : 'Nueva deuda'}
                    </DialogTitle>
                    <DialogDescription>
                        Registra el dinero que debes. No calcularemos intereses
                        por nuestra cuenta: anótalos al registrar cada pago.
                    </DialogDescription>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="debt-creditor">Acreedor</Label>
                            <Input
                                id="debt-creditor"
                                name="creditor"
                                defaultValue={debt?.creditor}
                                placeholder="Ej.: Banco, familiar…"
                                required
                                maxLength={100}
                            />
                            <InputError message={errors.creditor} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="debt-concept">Concepto</Label>
                            <Input
                                id="debt-concept"
                                name="concept"
                                defaultValue={debt?.concept}
                                placeholder="Ej.: Préstamo del coche"
                                required
                                maxLength={255}
                            />
                            <InputError message={errors.concept} />
                        </div>
                    </div>

                    <AmountInput
                        id="debt-principal"
                        name="principal"
                        label="Capital inicial"
                        defaultValue={debt?.principal ?? null}
                        error={errors.principal}
                        hint={
                            debt?.has_payments
                                ? 'Ya hay pagos: el capital inicial no puede cambiarse.'
                                : undefined
                        }
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="debt-started">
                                Fecha de inicio
                            </Label>
                            <Input
                                id="debt-started"
                                name="started_on"
                                type="date"
                                defaultValue={debt?.started_on ?? today}
                                required
                            />
                            <InputError message={errors.started_on} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="debt-rate">
                                Tipo de interés (%){' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="debt-rate"
                                name="interest_rate"
                                inputMode="decimal"
                                defaultValue={debt?.interest_rate ?? ''}
                                placeholder="Ej.: 4,5"
                            />
                            <InputError message={errors.interest_rate} />
                        </div>
                    </div>

                    {!debt && (
                        <div className="grid gap-2">
                            <Label htmlFor="debt-account">
                                ¿Recibiste el dinero en una cuenta?
                            </Label>
                            <NativeSelect
                                id="debt-account"
                                name="disbursement_account_id"
                                defaultValue=""
                            >
                                <option value="">
                                    No (por ejemplo, una compra aplazada)
                                </option>
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        Sí, en {account.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <p className="text-xs text-muted-foreground">
                                Si lo recibiste, sumará al saldo de esa cuenta
                                sin contar como ingreso.
                            </p>
                            <InputError
                                message={errors.disbursement_account_id}
                            />
                        </div>
                    )}

                    <fieldset className="grid gap-4 rounded-xl border p-4">
                        <legend className="px-1 text-sm font-medium">
                            Cuotas (opcional)
                        </legend>
                        <AmountInput
                            id="debt-installment"
                            name="installment"
                            label="Cuota aproximada"
                            defaultValue={debt?.installment ?? null}
                            error={errors.installment}
                            required={false}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="debt-frequency">
                                    Periodicidad
                                </Label>
                                <NativeSelect
                                    id="debt-frequency"
                                    name="frequency"
                                    defaultValue={debt?.frequency ?? ''}
                                >
                                    <option value="">Sin cuotas fijas</option>
                                    {frequencies.map((f) => (
                                        <option key={f.value} value={f.value}>
                                            {f.label}
                                        </option>
                                    ))}
                                </NativeSelect>
                                <InputError message={errors.frequency} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="debt-next">
                                    Próximo vencimiento
                                </Label>
                                <Input
                                    id="debt-next"
                                    name="next_due_on"
                                    type="date"
                                    defaultValue={debt?.next_due_on ?? ''}
                                />
                                <InputError message={errors.next_due_on} />
                            </div>
                        </div>
                    </fieldset>

                    <div className="grid gap-2">
                        <Label htmlFor="debt-notes">
                            Notas{' '}
                            <span className="font-normal text-muted-foreground">
                                (opcional)
                            </span>
                        </Label>
                        <Input
                            id="debt-notes"
                            name="notes"
                            defaultValue={debt?.notes ?? ''}
                            maxLength={2000}
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {debt ? 'Guardar cambios' : 'Registrar deuda'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

function PaymentForm({
    debt,
    settle,
    accounts,
    expenseCategories,
    defaultCategoryId,
    today,
    onDone,
}: Props & { debt: Debt; settle: boolean; onDone: () => void }) {
    const format = useFormat();
    const [uuid] = useState(() => newUuid());
    const [advances, setAdvances] = useState(true);

    if (accounts.length === 0) {
        return (
            <>
                <DialogTitle>Registrar pago</DialogTitle>
                <DialogDescription>
                    Necesitas al menos una cuenta activa desde la que pagar.
                </DialogDescription>
            </>
        );
    }

    return (
        <Form
            {...DebtController.storePayment.form(debt.id)}
            transform={(data) => ({
                ...normalizeAmountFields(
                    data,
                    ['principal', 'interest', 'fees'],
                    format.preferences.number_locale,
                ),
                advances_schedule: advances,
            })}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-5"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>
                        {settle
                            ? `Liquidar la deuda con ${debt.creditor}`
                            : `Pago a ${debt.creditor}`}
                    </DialogTitle>
                    <DialogDescription>
                        Separa el capital (reduce la deuda, no es un gasto) de
                        los intereses y comisiones (sí son gasto). Pendiente:{' '}
                        {format.money(debt.outstanding, debt.currency)}.
                    </DialogDescription>

                    <input type="hidden" name="uuid" value={uuid} />

                    <AmountInput
                        id="payment-principal"
                        name="principal"
                        label="Capital devuelto"
                        defaultValue={settle ? debt.outstanding : null}
                        error={errors.principal}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <AmountInput
                            id="payment-interest"
                            name="interest"
                            label="Intereses"
                            error={errors.interest}
                            required={false}
                        />
                        <AmountInput
                            id="payment-fees"
                            name="fees"
                            label="Comisiones"
                            error={errors.fees}
                            required={false}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="payment-account">
                                Pagado desde
                            </Label>
                            <NativeSelect
                                id="payment-account"
                                name="account_id"
                                defaultValue={accounts[0].id}
                            >
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.account_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="payment-date">Fecha</Label>
                            <Input
                                id="payment-date"
                                name="paid_on"
                                type="date"
                                defaultValue={today}
                                required
                            />
                            <InputError message={errors.paid_on} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="payment-category">
                            Categoría de los intereses y comisiones
                        </Label>
                        <NativeSelect
                            id="payment-category"
                            name="category_id"
                            defaultValue={
                                defaultCategoryId ??
                                expenseCategories[0]?.id ??
                                ''
                            }
                        >
                            <option value="">
                                Sin intereses ni comisiones
                            </option>
                            {expenseCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </NativeSelect>
                        <InputError message={errors.category_id} />
                    </div>

                    {debt.frequency && debt.next_due_on && !settle && (
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="payment-advances"
                                checked={advances}
                                onCheckedChange={(value) =>
                                    setAdvances(value === true)
                                }
                            />
                            <Label
                                htmlFor="payment-advances"
                                className="font-normal"
                            >
                                Corresponde a la cuota del{' '}
                                {format.day(debt.next_due_on)} (pasa al
                                siguiente vencimiento)
                            </Label>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {settle ? 'Liquidar' : 'Registrar pago'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

function PaymentHistory({
    debt,
    onVoid,
}: {
    debt: Debt;
    onVoid: (payment: Payment) => void;
}) {
    const format = useFormat();
    const money = (value: string) => format.money(value, debt.currency);

    return (
        <>
            <DialogTitle>Historial · {debt.creditor}</DialogTitle>
            <DialogDescription>
                Intereses pagados: {money(debt.interest_paid)} · Comisiones:{' '}
                {money(debt.fees_paid)}
            </DialogDescription>

            {debt.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Todavía no hay pagos.
                </p>
            ) : (
                <ul className="divide-y rounded-xl border">
                    {debt.payments.map((payment) => (
                        <li
                            key={payment.id}
                            className={
                                payment.voided ? 'p-3 opacity-60' : 'p-3'
                            }
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p
                                    className={
                                        payment.voided
                                            ? 'font-medium line-through'
                                            : 'font-medium'
                                    }
                                >
                                    {format.day(payment.paid_on)}
                                </p>
                                <p className="font-semibold tabular-nums">
                                    {money(payment.total)}
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Capital {money(payment.principal)} · Intereses{' '}
                                {money(payment.interest)} · Comisiones{' '}
                                {money(payment.fees)} · {payment.account}
                            </p>
                            {payment.voided ? (
                                <p className="text-xs text-muted-foreground">
                                    Anulado: {payment.void_reason}
                                </p>
                            ) : (
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto px-0 text-xs"
                                    onClick={() => onVoid(payment)}
                                >
                                    <Ban aria-hidden="true" />
                                    Anular este pago
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

function VoidPaymentForm({
    payment,
    onDone,
}: {
    payment: Payment;
    onDone: () => void;
}) {
    return (
        <Form
            {...DebtController.voidPayment.form(payment.id)}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-5"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>¿Anular este pago?</DialogTitle>
                    <DialogDescription>
                        Se anularán sus movimientos en la cuenta y el capital
                        volverá a figurar como pendiente. Quedará en el
                        historial.
                    </DialogDescription>
                    <div className="grid gap-2">
                        <Label htmlFor="void-payment-reason">Motivo</Label>
                        <Input
                            id="void-payment-reason"
                            name="reason"
                            required
                            maxLength={255}
                            autoFocus
                        />
                        <InputError message={errors.reason ?? errors.payment} />
                    </div>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing}
                        >
                            Anular pago
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

DebtsIndex.layout = {
    breadcrumbs: [{ title: 'Deudas', href: debtsIndex() }],
};
