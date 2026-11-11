/**
 * Formateo de importes y fechas según las preferencias del usuario.
 *
 * Solo presenta datos: los cálculos financieros los hace siempre el servidor.
 * Los importes llegan como cadenas decimales («1234.56») para no perder
 * precisión con números de coma flotante.
 */

export type FormatPreferences = {
    currency: string | null;
    /** Decimales de la moneda según el catálogo de la app. */
    currency_decimals: number | null;
    number_locale: string;
    timezone: string;
    locale: string;
};

const FALLBACK: FormatPreferences = {
    currency: null,
    currency_decimals: null,
    number_locale: 'es-ES',
    timezone: 'UTC',
    locale: 'es',
};

/**
 * Formatea un importe. Los decimales se fijan siempre según el catálogo de
 * la app: Intl usa los de la configuración regional (p. ej. 0 para el peso
 * colombiano en es-CO) y podría ocultar o redondear céntimos registrados.
 */
export function formatMoney(
    amount: string | number,
    prefs: FormatPreferences = FALLBACK,
    currency: string | null = prefs.currency,
    decimals: number | null = currency === prefs.currency
        ? prefs.currency_decimals
        : null,
): string {
    // Intl acepta cadenas decimales y las formatea sin convertirlas a float.
    const value =
        typeof amount === 'number'
            ? amount
            : (amount.trim() as Intl.StringNumericLiteral);
    const digits = decimals ?? 2;

    return new Intl.NumberFormat(prefs.number_locale, {
        ...(currency ? { style: 'currency', currency } : {}),
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatDateTime(
    value: string | null | undefined,
    prefs: FormatPreferences = FALLBACK,
): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(prefs.number_locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: prefs.timezone,
    }).format(new Date(value));
}

export function formatDate(
    value: string | null | undefined,
    prefs: FormatPreferences = FALLBACK,
): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(prefs.number_locale, {
        dateStyle: 'long',
        timeZone: prefs.timezone,
    }).format(new Date(value));
}

export function formatRelative(
    value: string | null | undefined,
    prefs: FormatPreferences = FALLBACK,
): string {
    if (!value) {
        return '—';
    }

    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31_536_000],
        ['month', 2_592_000],
        ['week', 604_800],
        ['day', 86_400],
        ['hour', 3_600],
        ['minute', 60],
    ];
    const rtf = new Intl.RelativeTimeFormat(prefs.locale, { numeric: 'auto' });

    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return rtf.format(Math.round(seconds / size), unit);
        }
    }

    return 'ahora mismo';
}

/** Zona horaria del navegador, como sugerencia en la primera configuración. */
export function browserTimeZone(): string | null {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
        return null;
    }
}
