import { router } from '@inertiajs/react';
import { useState } from 'react';
import DebtController from '@/actions/App/Http/Controllers/Finance/DebtController';
import { MoreOptions } from '@/components/finance/more-options';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
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
import { FREQUENCY_OPTIONS } from '@/lib/recurrence';

export type DebtData = {
    id: number;
    concept: string;
    creditor: string | null;
    principal: string;
    paid_before: string;
    installment: string | null;
    frequency: string | null;
    next_due_on: string | null;
    started_on: string;
};

/**
 * «¿Debes dinero?»: un préstamo, una compra a plazos o dinero de un amigo.
 * Apuntarla no es un gasto; solo cuentan los pagos que hagas.
 */
export function DebtForm({
    debt,
    today,
    onDone,
}: {
    debt: DebtData | null;
    today: string;
    onDone: () => void;
}) {
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const initial = (value: string | null | undefined) =>
        value && Number(value) !== 0 ? amountForInput(value, locale) : '';

    const [concept, setConcept] = useState(debt?.concept ?? '');
    const [creditor, setCreditor] = useState(debt?.creditor ?? '');
    const [total, setTotal] = useState(initial(debt?.principal));
    const [paidBefore, setPaidBefore] = useState(initial(debt?.paid_before));
    const [installment, setInstallment] = useState(initial(debt?.installment));
    const [frequency, setFrequency] = useState(debt?.frequency ?? 'monthly');
    const [nextDue, setNextDue] = useState(debt?.next_due_on ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const amount = (value: string) =>
        value.trim() === '' ? null : normalizeAmount(value, locale);

    const submit = () => {
        setSaving(true);
        const payload = {
            concept,
            creditor: creditor.trim() || null,
            principal: amount(total),
            paid_before: amount(paidBefore),
            started_on: debt?.started_on ?? today,
            installment: amount(installment),
            // Sin fecha de la próxima cuota no hay calendario.
            frequency: nextDue ? frequency : null,
            next_due_on: nextDue || null,
            interest_rate: null,
            notes: null,
        };
        const options = {
            preserveScroll: true,
            onSuccess: onDone,
            onError: (e: Record<string, string>) => setErrors(e),
            onFinish: () => setSaving(false),
        };

        if (debt) {
            router.put(DebtController.update.url(debt.id), payload, options);
        } else {
            router.post(DebtController.store.url(), payload, options);
        }
    };

    return (
        <form
            className="grid gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <DialogTitle className="text-xl">
                {debt ? `Editar «${debt.concept}»` : 'Apuntar una deuda'}
            </DialogTitle>
            <DialogDescription>
                Un préstamo, algo comprado a plazos o dinero que te dejaron.
                Apuntarla no cuenta como gasto: solo cuentan los pagos.
            </DialogDescription>

            <div className="grid gap-2">
                <Label htmlFor="debt-concept">¿Qué es?</Label>
                <Input
                    id="debt-concept"
                    value={concept}
                    onChange={(event) => setConcept(event.target.value)}
                    placeholder="Ej.: Portátil, préstamo de Juan, tarjeta"
                    maxLength={255}
                    required
                    autoComplete="off"
                />
                <InputError message={errors.concept} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="debt-total">¿Cuánto debías en total?</Label>
                    <Input
                        id="debt-total"
                        inputMode="decimal"
                        value={total}
                        onChange={(event) => setTotal(event.target.value)}
                        required
                        autoComplete="off"
                    />
                    <InputError message={errors.principal} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="debt-paid">¿Cuánto has pagado ya?</Label>
                    <Input
                        id="debt-paid"
                        inputMode="decimal"
                        value={paidBefore}
                        onChange={(event) => setPaidBefore(event.target.value)}
                        placeholder="0"
                        autoComplete="off"
                        aria-describedby="debt-paid-hint"
                    />
                    <p
                        id="debt-paid-hint"
                        className="text-xs text-muted-foreground"
                    >
                        Antes de apuntarla aquí. No cambia tu dinero de hoy.
                    </p>
                    <InputError message={errors.paid_before} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="debt-installment">
                        ¿Cuánto pagas por cuota?{' '}
                        <span className="font-normal text-muted-foreground">
                            (si hay)
                        </span>
                    </Label>
                    <Input
                        id="debt-installment"
                        inputMode="decimal"
                        value={installment}
                        onChange={(event) => setInstallment(event.target.value)}
                        autoComplete="off"
                    />
                    <InputError message={errors.installment} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="debt-frequency">¿Cada cuánto?</Label>
                    <NativeSelect
                        id="debt-frequency"
                        value={frequency}
                        onChange={(event) => setFrequency(event.target.value)}
                    >
                        {FREQUENCY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </NativeSelect>
                    <InputError message={errors.frequency} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="debt-next">
                        ¿Cuándo te toca pagar la próxima?{' '}
                        <span className="font-normal text-muted-foreground">
                            (si lo sabes)
                        </span>
                    </Label>
                    <Input
                        id="debt-next"
                        type="date"
                        value={nextDue}
                        onChange={(event) => setNextDue(event.target.value)}
                    />
                    <InputError message={errors.next_due_on} />
                </div>
            </div>

            <MoreOptions open={Boolean(debt?.creditor || errors.creditor)}>
                <div className="grid gap-2">
                    <Label htmlFor="debt-creditor">
                        ¿A quién se lo debes?{' '}
                        <span className="font-normal text-muted-foreground">
                            (opcional)
                        </span>
                    </Label>
                    <Input
                        id="debt-creditor"
                        value={creditor}
                        onChange={(event) => setCreditor(event.target.value)}
                        placeholder="Ej.: el banco, la tienda, Juan"
                        maxLength={100}
                        autoComplete="off"
                    />
                    <InputError message={errors.creditor} />
                </div>
            </MoreOptions>

            <DialogFooter>
                <Button
                    type="submit"
                    size="lg"
                    className="h-12 text-base"
                    disabled={saving}
                >
                    {saving && <Spinner />}
                    {debt ? 'Guardar cambios' : 'Guardar'}
                </Button>
            </DialogFooter>
        </form>
    );
}
