import { Form } from '@inertiajs/react';
import { useState } from 'react';
import RecurringRuleController from '@/actions/App/Http/Controllers/Finance/RecurringRuleController';
import AmountInput from '@/components/finance/amount-input';
import { MoreOptions } from '@/components/finance/more-options';
import { RecurrenceSummary } from '@/components/finance/recurrence-summary';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { normalizeAmountFields } from '@/lib/amount';
import type { FrequencyValue } from '@/lib/recurrence';
import type { AccountOption, CategoryOption } from '@/types/finance';

/** Pago o cobro que se repite (alquiler, nómina, suscripciones…). */
export type RuleData = {
    id: number;
    kind: 'income' | 'expense';
    concept: string;
    amount: string;
    account: { id: number; name: string };
    category: { id: number; name: string; icon: string; color: string };
    nature: 'fixed' | 'variable' | null;
    frequency: string;
    starts_on: string;
    ends_on: string | null;
};

type RuleFormProps = {
    kind: 'income' | 'expense';
    rule: RuleData | null;
    accounts: AccountOption[];
    categories: CategoryOption[];
    frequencies: { value: string; label: string }[];
    today: string;
    onDone: () => void;
};

/**
 * Formulario de un pago o cobro que se repite, con preguntas sencillas y una
 * frase que explica qué va a pasar. Lo usan «Mis pagos» y «Recurrentes».
 */
export function RuleForm({
    kind,
    rule,
    accounts,
    categories,
    frequencies,
    today,
    onDone,
}: RuleFormProps) {
    const format = useFormat();
    const isExpense = kind === 'expense';
    const [frequency, setFrequency] = useState<FrequencyValue>(
        (rule?.frequency as FrequencyValue | undefined) ?? 'monthly',
    );
    const [startsOn, setStartsOn] = useState(rule?.starts_on ?? today);
    const [endsOn, setEndsOn] = useState(rule?.ends_on ?? '');
    const form = rule
        ? RecurringRuleController.update.form(rule.id)
        : RecurringRuleController.store.form();
    const accountOptions = accounts.filter(
        (a) => !a.archived || a.id === rule?.account.id,
    );
    const categoryOptions = categories.filter(
        (c) => c.kind === kind && (!c.archived || c.id === rule?.category.id),
    );
    const noun = isExpense ? 'pago' : 'cobro';

    if (accountOptions.length === 0) {
        return (
            <>
                <DialogTitle>
                    {isExpense
                        ? 'Gasto que se repite'
                        : 'Ingreso que se repite'}
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
                            ? `Editar «${rule.concept}»`
                            : isExpense
                              ? 'Gasto que se repite'
                              : 'Ingreso que se repite'}
                    </DialogTitle>
                    <DialogDescription>
                        {rule
                            ? 'Los cambios se aplican a los próximos pendientes; lo que ya marcaste como hecho no cambia.'
                            : isExpense
                              ? 'Para pagos fijos como el alquiler, la luz o una suscripción. Te avisaremos de cada uno.'
                              : 'Para cobros fijos como la nómina o una pensión. Te avisaremos de cada uno.'}
                    </DialogDescription>

                    {!rule && <input type="hidden" name="kind" value={kind} />}

                    <div className="grid gap-2">
                        <Label htmlFor="rule-concept">¿Qué es?</Label>
                        <Input
                            id="rule-concept"
                            name="concept"
                            defaultValue={rule?.concept}
                            placeholder={
                                isExpense ? 'Ej.: Alquiler' : 'Ej.: Nómina'
                            }
                            required
                            maxLength={255}
                            autoComplete="off"
                        />
                        <InputError message={errors.concept} />
                    </div>

                    <AmountInput
                        id="rule-amount"
                        name="amount"
                        label="¿Cuánto es cada vez?"
                        defaultValue={rule?.amount ?? null}
                        error={errors.amount}
                        hint="Si cambia un poco cada vez (como la luz), pon un importe aproximado."
                    />

                    <div className="grid items-start gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="rule-frequency">
                                ¿Cada cuánto se repite?
                            </Label>
                            <NativeSelect
                                id="rule-frequency"
                                name="frequency"
                                value={frequency}
                                onChange={(event) =>
                                    setFrequency(
                                        event.target.value as FrequencyValue,
                                    )
                                }
                            >
                                {frequencies.map((f) => (
                                    <option key={f.value} value={f.value}>
                                        {f.label}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.frequency} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="rule-start">
                                ¿Qué día toca el {noun}?
                            </Label>
                            <Input
                                id="rule-start"
                                name="starts_on"
                                type="date"
                                value={startsOn}
                                onChange={(event) =>
                                    setStartsOn(event.target.value)
                                }
                                required
                                aria-describedby="rule-start-hint"
                            />
                            <p
                                id="rule-start-hint"
                                className="text-xs text-muted-foreground"
                            >
                                Elige una fecha en la que toque: el resto se
                                calcula a partir de ella.
                            </p>
                            <InputError message={errors.starts_on} />
                        </div>
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
                                {isExpense
                                    ? '¿De qué cuenta sale?'
                                    : '¿En qué cuenta entra?'}
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
                    </div>

                    <RecurrenceSummary
                        frequency={frequency}
                        startsOn={startsOn}
                        endsOn={endsOn || null}
                        today={today}
                        kind={kind}
                    />

                    <MoreOptions
                        open={Boolean(
                            rule?.ends_on || errors.ends_on || errors.nature,
                        )}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="rule-end">
                                ¿Termina algún día?{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="rule-end"
                                name="ends_on"
                                type="date"
                                value={endsOn}
                                onChange={(event) =>
                                    setEndsOn(event.target.value)
                                }
                                aria-describedby="rule-end-hint"
                            />
                            <p
                                id="rule-end-hint"
                                className="text-xs text-muted-foreground"
                            >
                                Por ejemplo, el último plazo de una compra.
                                Déjalo vacío si no tiene fin.
                            </p>
                            <InputError message={errors.ends_on} />
                        </div>
                        {isExpense && (
                            <div className="grid gap-2">
                                <Label htmlFor="rule-nature">
                                    ¿El importe cambia?
                                </Label>
                                <NativeSelect
                                    id="rule-nature"
                                    name="nature"
                                    defaultValue={rule?.nature ?? 'fixed'}
                                >
                                    <option value="fixed">
                                        No, siempre es el mismo (gasto fijo)
                                    </option>
                                    <option value="variable">
                                        Sí, varía (gasto variable)
                                    </option>
                                </NativeSelect>
                                <InputError message={errors.nature} />
                            </div>
                        )}
                    </MoreOptions>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {rule ? 'Guardar cambios' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}
