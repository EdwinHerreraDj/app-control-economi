/**
 * Frases en lenguaje cotidiano para explicar una recurrencia mientras se
 * rellena el formulario: «Se repetirá cada mes, el día 5…».
 *
 * Coincide con el cálculo del servidor (Frequency::occurrence): las fechas
 * se cuentan siempre desde la primera, y un día 31 cae el último día de los
 * meses que no lo tienen (y vuelve al 31 en los que sí).
 */

export type FrequencyValue =
    | 'weekly'
    | 'biweekly'
    | 'monthly'
    | 'bimonthly'
    | 'quarterly'
    | 'semiannual'
    | 'yearly';

/** Mismas etiquetas que el servidor (App\Enums\Frequency::label). */
export const FREQUENCY_OPTIONS: { value: FrequencyValue; label: string }[] = [
    { value: 'weekly', label: 'Cada semana' },
    { value: 'biweekly', label: 'Cada 2 semanas' },
    { value: 'monthly', label: 'Cada mes' },
    { value: 'bimonthly', label: 'Cada 2 meses' },
    { value: 'quarterly', label: 'Cada 3 meses' },
    { value: 'semiannual', label: 'Cada 6 meses' },
    { value: 'yearly', label: 'Cada año' },
];

const MONTHS: Partial<Record<FrequencyValue, number>> = {
    monthly: 1,
    bimonthly: 2,
    quarterly: 3,
    semiannual: 6,
    yearly: 12,
};

function parseDay(value: string | null | undefined): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');

    if (!match) {
        return null;
    }

    return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
}

function iso(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function fmt(date: Date, locale: string, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: 'UTC',
    }).format(date);
}

/** Fecha número n (0 = la primera), calculada desde la primera. */
export function occurrence(
    frequency: FrequencyValue,
    start: string,
    n: number,
): string | null {
    const date = parseDay(start);

    if (!date) {
        return null;
    }

    if (frequency === 'weekly' || frequency === 'biweekly') {
        date.setUTCDate(
            date.getUTCDate() + n * (frequency === 'weekly' ? 7 : 14),
        );

        return iso(date);
    }

    const day = date.getUTCDate();
    const target = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth() + n * (MONTHS[frequency] ?? 1),
            1,
        ),
    );
    const last = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, last));

    return iso(target);
}

/**
 * Primera fecha que se añadirá como pendiente: la primera desde hoy (las
 * anteriores no se crean).
 */
export function firstFrom(
    frequency: FrequencyValue,
    start: string,
    from: string,
): string | null {
    for (let n = 0; n < 2000; n++) {
        const date = occurrence(frequency, start, n);

        if (date === null) {
            return null;
        }

        if (date >= from) {
            return date;
        }
    }

    return null;
}

/**
 * «cada mes, el día 5» / «cada semana, los jueves» / «cada año, el 5 de
 * diciembre».
 */
export function describeRhythm(
    frequency: FrequencyValue,
    start: string,
    locale: string,
): string {
    const date = parseDay(start);

    if (!date) {
        return '';
    }

    const day = date.getUTCDate();

    switch (frequency) {
        case 'weekly':
            return `cada semana, los ${fmt(date, locale, { weekday: 'long' })}`;
        case 'biweekly':
            return `cada 2 semanas, los ${fmt(date, locale, { weekday: 'long' })}`;
        case 'yearly':
            return `cada año, el ${fmt(date, locale, { day: 'numeric', month: 'long' })}`;
        default: {
            const months = MONTHS[frequency] ?? 1;
            const every = months === 1 ? 'cada mes' : `cada ${months} meses`;
            const shortMonths =
                day > 28
                    ? ' (el último día en los meses que no lo tienen)'
                    : '';

            return `${every}, el día ${day}${shortMonths}`;
        }
    }
}

export function longDate(value: string, locale: string): string {
    const date = parseDay(value);

    return date
        ? fmt(date, locale, { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
}

/**
 * Resumen de la recurrencia para mostrar bajo el formulario, o null si aún
 * no hay una fecha válida.
 */
export function describeRecurrence({
    frequency,
    startsOn,
    endsOn,
    today,
    locale,
    kind,
}: {
    frequency: FrequencyValue;
    startsOn: string;
    endsOn?: string | null;
    today: string;
    locale: string;
    kind: 'income' | 'expense';
}): { rhythm: string; first: string | null; ends: string | null } | null {
    if (!parseDay(startsOn)) {
        return null;
    }

    const first = firstFrom(frequency, startsOn, today);
    const end = parseDay(endsOn) ? (endsOn as string) : null;
    const noun = kind === 'income' ? 'cobro' : 'pago';

    return {
        rhythm: `Se repetirá ${describeRhythm(frequency, startsOn, locale)}.`,
        first:
            first && (!end || first <= end)
                ? `El primer ${noun} pendiente será el ${longDate(first, locale)}.`
                : null,
        ends: end ? `Termina el ${longDate(end, locale)}.` : null,
    };
}
