import { useState } from 'react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormat } from '@/hooks/use-format';
import { amountForInput, normalizeAmount } from '@/lib/amount';

type Props = {
    id: string;
    name: string;
    label: string;
    defaultValue?: string | null;
    error?: string;
    allowNegative?: boolean;
    hint?: string;
};

/**
 * Campo de importe en el formato regional del usuario. Muestra debajo cómo
 * se ha interpretado lo escrito, para detectar errores de separadores.
 * El formulario debe normalizar el valor con normalizeAmount() al enviar.
 */
export default function AmountInput({
    id,
    name,
    label,
    defaultValue,
    error,
    allowNegative = false,
    hint,
}: Props) {
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const [value, setValue] = useState(
        defaultValue ? amountForInput(defaultValue, locale) : '',
    );

    const normalized = normalizeAmount(value, locale);
    const valid = /^-?\d+(\.\d+)?$/.test(normalized);
    const preview =
        value !== '' && valid ? format.money(normalized as `${number}`) : null;

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                name={name}
                inputMode="decimal"
                autoComplete="off"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={amountForInput('0.00', locale)}
                className="text-lg font-medium tabular-nums"
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-preview`}
            />
            <p
                id={`${id}-preview`}
                className="min-h-4 text-xs text-muted-foreground"
                aria-live="polite"
            >
                {preview
                    ? `Se registrará como ${preview}`
                    : (hint ??
                      (allowNegative
                          ? 'Puedes usar un signo menos si el saldo es negativo.'
                          : ''))}
            </p>
            <InputError message={error} />
        </div>
    );
}
