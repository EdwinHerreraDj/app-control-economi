import { Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { FormatPreferences } from '@/lib/format';

export type PreferenceOptions = {
    currencies: { code: string; name: string; decimals: number }[];
    numberLocales: { value: string; label: string }[];
    timezones: string[];
    locales: { value: string; label: string }[];
};

export type PreferenceValues = {
    currency: string | null;
    number_locale: string;
    timezone: string;
    locale: string;
};

type Props = {
    options: PreferenceOptions;
    defaults: PreferenceValues;
    errors: Partial<Record<keyof PreferenceValues, string>>;
    /** Falso cuando ya hay datos financieros y la moneda no puede cambiarse. */
    canChangeCurrency?: boolean;
};

/** Agrupa las zonas horarias por continente («Europe/Madrid» → «Europe»). */
function groupTimezones(timezones: string[]): [string, string[]][] {
    const groups = new Map<string, string[]>();

    for (const zone of timezones) {
        const region = zone.includes('/') ? zone.split('/')[0] : 'Otras';
        groups.set(region, [...(groups.get(region) ?? []), zone]);
    }

    return [...groups.entries()];
}

export default function PreferencesFields({
    options,
    defaults,
    errors,
    canChangeCurrency = true,
}: Props) {
    const [currency, setCurrency] = useState(defaults.currency ?? '');
    const [numberLocale, setNumberLocale] = useState(defaults.number_locale);
    const [timezone, setTimezone] = useState(defaults.timezone);

    const timezoneGroups = useMemo(
        () => groupTimezones(options.timezones),
        [options.timezones],
    );

    const preview: FormatPreferences = {
        currency: currency || null,
        currency_decimals:
            options.currencies.find((option) => option.code === currency)
                ?.decimals ?? null,
        number_locale: numberLocale,
        timezone,
        locale: defaults.locale,
    };

    return (
        <div className="grid gap-6">
            <div className="grid gap-2">
                <Label htmlFor="currency">Moneda principal</Label>
                <NativeSelect
                    id="currency"
                    name="currency"
                    required
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    disabled={!canChangeCurrency}
                    aria-invalid={errors.currency ? true : undefined}
                    aria-describedby="currency-hint"
                >
                    <option value="" disabled>
                        Elige una moneda…
                    </option>
                    {options.currencies.map((option) => (
                        <option key={option.code} value={option.code}>
                            {option.name} ({option.code})
                        </option>
                    ))}
                </NativeSelect>
                {!canChangeCurrency && (
                    // Un select deshabilitado no se envía con el formulario.
                    <input type="hidden" name="currency" value={currency} />
                )}
                <p
                    id="currency-hint"
                    className="flex gap-2 text-xs text-muted-foreground"
                >
                    <Info
                        className="mt-px size-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    {canChangeCurrency ? (
                        <span>
                            Todos tus importes se registrarán en esta moneda.
                            Podrás cambiarla mientras no tengas movimientos; a
                            partir de entonces queda fijada para no alterar tu
                            historial.
                        </span>
                    ) : (
                        <span>
                            Ya tienes datos registrados en esta moneda. Para no
                            reinterpretar tus importes, no se puede cambiar por
                            ahora y no se hace ninguna conversión automática.
                        </span>
                    )}
                </p>
                <InputError message={errors.currency} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="number_locale">
                    Formato de importes y fechas
                </Label>
                <NativeSelect
                    id="number_locale"
                    name="number_locale"
                    required
                    value={numberLocale}
                    onChange={(event) => setNumberLocale(event.target.value)}
                    aria-invalid={errors.number_locale ? true : undefined}
                >
                    {options.numberLocales.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label} —{' '}
                            {formatMoney('1234.56', {
                                ...preview,
                                number_locale: option.value,
                                currency: null,
                            })}
                        </option>
                    ))}
                </NativeSelect>
                <InputError message={errors.number_locale} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="timezone">Zona horaria</Label>
                <NativeSelect
                    id="timezone"
                    name="timezone"
                    required
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    aria-invalid={errors.timezone ? true : undefined}
                >
                    {timezoneGroups.map(([region, zones]) => (
                        <optgroup key={region} label={region}>
                            {zones.map((zone) => (
                                <option key={zone} value={zone}>
                                    {zone.replaceAll('_', ' ')}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </NativeSelect>
                <InputError message={errors.timezone} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="locale">Idioma</Label>
                <NativeSelect
                    id="locale"
                    name="locale"
                    defaultValue={defaults.locale}
                    aria-describedby="locale-hint"
                >
                    {options.locales.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </NativeSelect>
                <p id="locale-hint" className="text-xs text-muted-foreground">
                    Por ahora la aplicación está disponible en español.
                </p>
                <InputError message={errors.locale} />
            </div>

            <section
                aria-label="Vista previa"
                aria-live="polite"
                className="rounded-lg border bg-muted/50 p-4 text-sm"
            >
                <p className="mb-1 font-medium">Así verás tus datos</p>
                <p>
                    Importe:{' '}
                    <strong className="tabular-nums">
                        {currency
                            ? formatMoney('1234.56', preview)
                            : 'elige una moneda'}
                    </strong>
                </p>
                <p>
                    Fecha y hora:{' '}
                    <strong>
                        {formatDateTime(new Date().toISOString(), preview)}
                    </strong>
                </p>
            </section>
        </div>
    );
}
