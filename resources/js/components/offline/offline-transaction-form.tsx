import { useState } from 'react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { amountForInput, normalizeAmount } from '@/lib/amount';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { todayIn } from '@/offline/money';
import type {
    OfflineSnapshot,
    PendingOperation,
    TransactionPayload,
} from '@/offline/types';

type Props = {
    snapshot: OfflineSnapshot;
    /** Movimiento rechazado que se corrige. */
    operation?: PendingOperation;
    submitLabel?: string;
    onSubmit: (
        payload: TransactionPayload,
        labels: PendingOperation['labels'],
    ) => Promise<void>;
    onCancel?: () => void;
};

/**
 * Alta de un ingreso o gasto sin conexión. Se guarda en el dispositivo y se
 * envía al recuperar la conexión; el servidor lo valida de nuevo.
 */
export function OfflineTransactionForm({
    snapshot,
    operation,
    submitLabel = 'Guardar en el dispositivo',
    onSubmit,
    onCancel,
}: Props) {
    const prefs = snapshot.preferences;
    const locale = prefs.number_locale;
    const initial = operation?.payload;
    const idPrefix = operation ? `edit-${operation.uuid.slice(0, 8)}` : 'new';

    const [kind, setKind] = useState<'income' | 'expense'>(
        initial?.kind ?? 'expense',
    );
    const [amount, setAmount] = useState(
        initial ? amountForInput(initial.amount, locale) : '',
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const accounts = snapshot.accounts.filter((account) => !account.archived);
    // Por defecto, la cuenta del último movimiento (la de uso habitual).
    const usual =
        accounts.find(
            (account) => account.name === snapshot.recent[0]?.account,
        ) ?? accounts[0];
    const categories = snapshot.categories.filter(
        (category) => category.kind === kind,
    );

    const normalized = normalizeAmount(amount, locale);
    const validAmount = /^\d+(\.\d+)?$/.test(normalized);
    const preview =
        amount !== '' && validAmount
            ? formatMoney(normalized as `${number}`, prefs)
            : null;

    if (accounts.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No tienes cuentas activas guardadas en este dispositivo. Crea
                una cuenta con conexión para poder registrar movimientos.
            </p>
        );
    }

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const text = (name: string) => {
            const value = data.get(name);

            return typeof value === 'string' ? value.trim() : '';
        };
        const accountId = Number(text('account_id'));
        const categoryId = Number(text('category_id'));
        const concept = text('concept');
        const occurredOn = text('occurred_on');
        const notes = text('notes');
        const found: Record<string, string> = {};

        if (!validAmount || Number(normalized) <= 0) {
            found.amount = 'Escribe un importe mayor que cero.';
        }

        if (!concept) {
            found.concept = 'Escribe un concepto.';
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
            found.occurred_on = 'Elige una fecha.';
        }

        if (!categoryId) {
            found.category_id = 'Elige una categoría.';
        }

        setErrors(found);

        if (Object.keys(found).length > 0) {
            return;
        }

        setSaving(true);

        try {
            await onSubmit(
                {
                    kind,
                    account_id: accountId,
                    category_id: categoryId,
                    amount: normalized,
                    occurred_on: occurredOn,
                    status:
                        data.get('status') === 'planned'
                            ? 'planned'
                            : 'confirmed',
                    concept,
                    notes: notes === '' ? null : notes,
                },
                {
                    account:
                        accounts.find((account) => account.id === accountId)
                            ?.name ?? '',
                    category:
                        categories.find(
                            (category) => category.id === categoryId,
                        )?.name ?? '',
                },
            );

            if (!operation) {
                form.reset();
                setAmount('');
            }
        } finally {
            setSaving(false);
        }
    };

    const isExpense = kind === 'expense';

    return (
        <form onSubmit={submit} className="space-y-4" noValidate>
            <fieldset>
                <legend className="sr-only">Tipo de movimiento</legend>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                    {(
                        [
                            ['expense', 'Gasto'],
                            ['income', 'Ingreso'],
                        ] as const
                    ).map(([value, label]) => (
                        <label
                            key={value}
                            className={cn(
                                'cursor-pointer rounded-md px-3 py-2 text-center text-sm font-medium has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                kind === value
                                    ? 'bg-background shadow-xs'
                                    : 'text-muted-foreground',
                            )}
                        >
                            <input
                                type="radio"
                                name="kind"
                                value={value}
                                checked={kind === value}
                                onChange={() => setKind(value)}
                                className="sr-only"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-amount`}>Importe</Label>
                <Input
                    id={`${idPrefix}-amount`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={amountForInput('0.00', locale)}
                    className="text-lg font-medium tabular-nums"
                    aria-invalid={errors.amount ? true : undefined}
                    aria-describedby={`${idPrefix}-amount-preview`}
                    required
                />
                <p
                    id={`${idPrefix}-amount-preview`}
                    className="min-h-4 text-xs text-muted-foreground"
                    aria-live="polite"
                >
                    {preview ? `Se registrará como ${preview}` : ''}
                </p>
                <InputError message={errors.amount} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-concept`}>Concepto</Label>
                <Input
                    id={`${idPrefix}-concept`}
                    name="concept"
                    defaultValue={initial?.concept}
                    placeholder={
                        isExpense ? 'Ej.: Supermercado' : 'Ej.: Nómina'
                    }
                    maxLength={255}
                    autoComplete="off"
                    required
                    aria-invalid={errors.concept ? true : undefined}
                />
                <InputError message={errors.concept} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-category`}>Categoría</Label>
                    <NativeSelect
                        key={kind}
                        id={`${idPrefix}-category`}
                        name="category_id"
                        defaultValue={
                            initial?.kind === kind
                                ? initial.category_id
                                : categories[0]?.id
                        }
                        required
                    >
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <InputError message={errors.category_id} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-account`}>
                        {isExpense ? 'Pagado desde' : 'Cobrado en'}
                    </Label>
                    <NativeSelect
                        id={`${idPrefix}-account`}
                        name="account_id"
                        defaultValue={initial?.account_id ?? usual?.id}
                        required
                    >
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.name}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-date`}>Fecha</Label>
                    <Input
                        id={`${idPrefix}-date`}
                        type="date"
                        name="occurred_on"
                        defaultValue={
                            initial?.occurred_on ?? todayIn(prefs.timezone)
                        }
                        required
                        aria-invalid={errors.occurred_on ? true : undefined}
                    />
                    <InputError message={errors.occurred_on} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-status`}>Estado</Label>
                    <NativeSelect
                        id={`${idPrefix}-status`}
                        name="status"
                        defaultValue={initial?.status ?? 'confirmed'}
                    >
                        <option value="confirmed">
                            {isExpense ? 'Ya pagado' : 'Ya cobrado'}
                        </option>
                        <option value="planned">Previsto</option>
                    </NativeSelect>
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-notes`}>Notas (opcional)</Label>
                <Input
                    id={`${idPrefix}-notes`}
                    name="notes"
                    defaultValue={initial?.notes ?? ''}
                    maxLength={2000}
                    autoComplete="off"
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                    {submitLabel}
                </Button>
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancelar
                    </Button>
                )}
            </div>
        </form>
    );
}
