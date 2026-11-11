// Formateo de fechas para la interfaz. La configuración regional del usuario
// llegará con las preferencias personales (fase 3); por ahora, español.
const LOCALE = 'es-ES';

export function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(LOCALE, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function formatRelative(value: string | null | undefined): string {
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
    const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return rtf.format(Math.round(seconds / size), unit);
        }
    }

    return 'ahora mismo';
}
