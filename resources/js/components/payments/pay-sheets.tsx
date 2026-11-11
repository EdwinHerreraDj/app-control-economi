import { router } from '@inertiajs/react';
import { useState } from 'react';
import DebtController from '@/actions/App/Http/Controllers/Finance/DebtController';
import TransactionController from '@/actions/App/Http/Controllers/Finance/TransactionController';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { amountForInput, normalizeAmount } from '@/lib/amount';
import { fromMinor, toMinor } from '@/offline/money';
import { newUuid } from '@/offline/storage';

export type PayAccount = { id: number; name: string; savings?: boolean };

/** Algo pendiente de pagar o cobrar (un pago habitual o un cobro previsto). */
export type PendingItem = {
    id: number;
    concept: string;
    amount: string;
    date: string;
    overdue: boolean;
    account?: { id: number; name: string };
    variable?: boolean;
};

/** Próxima cuota de una deuda. */
export type InstallmentItem = {
    id: number;
    concept: string;
    amount: string;
    date: string;
    overdue: boolean;
};

function useAmount(initial: string) {
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const [value, setValue] = useState(amountForInput(initial, locale));
    const normalized = normalizeAmount(value, locale);
    const valid = /^\d+(\.\d+)?$/.test(normalized) && Number(normalized) > 0;

    return { value, setValue, normalized, valid, format };
}

function AccountPicker({
    accounts,
    value,
    onChange,
    label,
}: {
    accounts: PayAccount[];
    value: number | null;
    onChange: (id: number) => void;
    label: string;
}) {
    if (accounts.length <= 1) {
        return null;
    }

    return (
        <div className="grid gap-2">
            <Label htmlFor="pay-account">{label}</Label>
            <NativeSelect
                id="pay-account"
                value={value ?? undefined}
                onChange={(event) => onChange(Number(event.target.value))}
            >
                {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                        {account.name}
                    </option>
                ))}
            </NativeSelect>
        </div>
    );
}

/**
 * «Ya lo pagué» / «Ya lo cobré»: confirma lo pendiente con lo que pasó de
 * verdad (el importe puede cambiar, como la luz). Solo entonces cuenta.
 */
export function ConfirmPendingSheet({
    item,
    kind,
    accounts,
    today,
    onClose,
}: {
    item: PendingItem | null;
    kind: 'expense' | 'income';
    accounts: PayAccount[];
    today: string;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={item !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {item && (
                    <ConfirmPendingForm
                        key={item.id}
                        item={item}
                        kind={kind}
                        accounts={accounts}
                        today={today}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function ConfirmPendingForm({
    item,
    kind,
    accounts,
    today,
    onClose,
}: {
    item: PendingItem;
    kind: 'expense' | 'income';
    accounts: PayAccount[];
    today: string;
    onClose: () => void;
}) {
    const amount = useAmount(item.amount);
    const spendable = accounts.filter((a) => !a.savings);
    const [date, setDate] = useState(today);
    const [accountId, setAccountId] = useState<number | null>(
        item.account?.id ?? spendable[0]?.id ?? null,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const isIncome = kind === 'income';

    return (
        <form
            className="grid gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                setSaving(true);
                router.post(
                    TransactionController.confirm.url(item.id),
                    {
                        amount: amount.normalized,
                        occurred_on: date,
                        account_id: accountId,
                    },
                    {
                        preserveScroll: true,
                        onSuccess: onClose,
                        onError: setErrors,
                        onFinish: () => setSaving(false),
                    },
                );
            }}
        >
            <DialogTitle className="text-xl">
                {isIncome ? 'Ya lo cobré' : 'Ya lo pagué'}: {item.concept}
            </DialogTitle>
            <DialogDescription>
                {item.variable
                    ? 'Este importe cambia cada vez: pon lo que te han cobrado de verdad.'
                    : 'Comprueba el importe y la fecha. Al guardarlo, se descuenta de tu dinero.'}
            </DialogDescription>

            <div className="grid gap-2">
                <Label htmlFor="pay-amount" className="text-base">
                    {isIncome
                        ? '¿Cuánto te ha llegado?'
                        : '¿Cuánto has pagado?'}
                </Label>
                <Input
                    id="pay-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount.value}
                    onChange={(event) => amount.setValue(event.target.value)}
                    className="h-14 text-3xl font-semibold tabular-nums md:text-3xl"
                />
                <InputError message={errors.amount} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="pay-date">¿Cuándo?</Label>
                <Input
                    id="pay-date"
                    type="date"
                    value={date}
                    max={today}
                    onChange={(event) => setDate(event.target.value)}
                />
                <InputError message={errors.occurred_on} />
            </div>

            <AccountPicker
                accounts={spendable}
                value={accountId}
                onChange={setAccountId}
                label={isIncome ? '¿Dónde lo recibiste?' : '¿Con qué pagaste?'}
            />

            <InputError message={errors.transaction ?? errors.account_id} />

            <DialogFooter>
                <Button
                    type="submit"
                    size="lg"
                    className="h-12 text-base"
                    disabled={saving || !amount.valid}
                >
                    {saving && <Spinner />}
                    {isIncome ? 'Sí, ya lo cobré' : 'Sí, ya lo pagué'}
                </Button>
            </DialogFooter>
        </form>
    );
}

/**
 * «Pagué una cuota»: el importe pagado reduce lo que falta. Los intereses o
 * comisiones son opcionales y se apuntan como gasto aparte.
 */
export function DebtPaymentSheet({
    item,
    accounts,
    today,
    interestCategoryId,
    onClose,
}: {
    item: InstallmentItem | null;
    accounts: PayAccount[];
    today: string;
    interestCategoryId: number | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={item !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {item && (
                    <DebtPaymentForm
                        key={item.id}
                        item={item}
                        accounts={accounts}
                        today={today}
                        interestCategoryId={interestCategoryId}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function DebtPaymentForm({
    item,
    accounts,
    today,
    interestCategoryId,
    onClose,
}: {
    item: InstallmentItem;
    accounts: PayAccount[];
    today: string;
    interestCategoryId: number | null;
    onClose: () => void;
}) {
    const amount = useAmount(item.amount);
    const interest = useAmount('');
    const spendable = accounts.filter((a) => !a.savings);
    const [uuid] = useState(() => newUuid());
    const [date, setDate] = useState(today);
    const [accountId, setAccountId] = useState<number | null>(
        spendable[0]?.id ?? null,
    );
    const [showMore, setShowMore] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Lo que reduce la deuda es el pago menos los intereses y comisiones,
    // calculado en céntimos enteros (nunca con decimales flotantes).
    const decimals = amount.format.preferences.currency_decimals ?? 2;
    const interestCents = interest.valid
        ? toMinor(interest.normalized, decimals)
        : 0;
    const totalCents = amount.valid ? toMinor(amount.normalized, decimals) : 0;
    const principal = fromMinor(totalCents - interestCents, decimals);

    return (
        <form
            className="grid gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                setSaving(true);
                router.post(
                    DebtController.storePayment.url(item.id),
                    {
                        uuid,
                        account_id: accountId,
                        category_id:
                            interestCents > 0 ? interestCategoryId : null,
                        paid_on: date,
                        principal,
                        interest:
                            interestCents > 0 ? interest.normalized : null,
                        fees: null,
                        notes: null,
                        advances_schedule: true,
                    },
                    {
                        preserveScroll: true,
                        onSuccess: onClose,
                        onError: setErrors,
                        onFinish: () => setSaving(false),
                    },
                );
            }}
        >
            <DialogTitle className="text-xl">
                Pagué una cuota: {item.concept}
            </DialogTitle>
            <DialogDescription>
                Puedes pagar más o menos que la cuota: lo que falta se recalcula
                con lo que pagas de verdad.
            </DialogDescription>

            <div className="grid gap-2">
                <Label htmlFor="debt-amount" className="text-base">
                    ¿Cuánto has pagado?
                </Label>
                <Input
                    id="debt-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount.value}
                    onChange={(event) => amount.setValue(event.target.value)}
                    className="h-14 text-3xl font-semibold tabular-nums md:text-3xl"
                />
                <InputError message={errors.principal} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="debt-date">¿Cuándo?</Label>
                <Input
                    id="debt-date"
                    type="date"
                    value={date}
                    max={today}
                    onChange={(event) => setDate(event.target.value)}
                />
                <InputError message={errors.paid_on} />
            </div>

            <AccountPicker
                accounts={spendable}
                value={accountId}
                onChange={setAccountId}
                label="¿Con qué pagaste?"
            />

            {showMore ? (
                <div className="grid gap-2">
                    <Label htmlFor="debt-interest">
                        ¿Cuánto de ese pago fueron intereses o comisiones?
                    </Label>
                    <Input
                        id="debt-interest"
                        inputMode="decimal"
                        autoComplete="off"
                        value={interest.value}
                        onChange={(event) =>
                            interest.setValue(event.target.value)
                        }
                    />
                    <p className="text-xs text-muted-foreground">
                        Esa parte no reduce la deuda: se apunta como gasto.
                    </p>
                    <InputError
                        message={errors.interest ?? errors.category_id}
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="justify-self-start text-sm text-primary underline-offset-4 hover:underline"
                    onClick={() => setShowMore(true)}
                >
                    ¿Incluía intereses o comisiones?
                </button>
            )}

            <InputError message={errors.account_id} />

            <DialogFooter>
                <Button
                    type="submit"
                    size="lg"
                    className="h-12 text-base"
                    disabled={
                        saving || !amount.valid || interestCents >= totalCents
                    }
                >
                    {saving && <Spinner />}
                    Guardar el pago
                </Button>
            </DialogFooter>
        </form>
    );
}
