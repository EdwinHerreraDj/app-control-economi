import { Repeat } from 'lucide-react';
import { useFormat } from '@/hooks/use-format';
import { describeRecurrence } from '@/lib/recurrence';
import type { FrequencyValue } from '@/lib/recurrence';

/**
 * Explica en una frase qué va a pasar con la recurrencia, y cómo se usa:
 * cada fecha aparece como pendiente y solo cuenta al marcarla como hecha.
 */
export function RecurrenceSummary({
    frequency,
    startsOn,
    endsOn,
    today,
    kind,
    skipFirst = false,
}: {
    frequency: FrequencyValue;
    startsOn: string;
    endsOn?: string | null;
    today: string;
    kind: 'income' | 'expense';
    /** La primera fecha ya es el movimiento que se está registrando. */
    skipFirst?: boolean;
}) {
    const format = useFormat();
    const summary = describeRecurrence({
        frequency,
        startsOn,
        endsOn,
        // Al registrar un movimiento que se repite, la primera vez es ese
        // mismo: la siguiente pendiente es la de después.
        today: skipFirst ? nextDay(startsOn, today) : today,
        locale: format.preferences.number_locale,
        kind,
    });

    if (!summary) {
        return null;
    }

    const done = kind === 'income' ? 'cobrado' : 'pagado';

    return (
        <div
            className="flex gap-3 rounded-lg bg-primary/5 p-3 text-sm"
            aria-live="polite"
        >
            <Repeat
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
            />
            <div className="space-y-1">
                <p className="font-medium">
                    {summary.rhythm} {summary.first}
                </p>
                {summary.ends && <p>{summary.ends}</p>}
                <p className="text-muted-foreground">
                    Cada vez aparecerá como pendiente en Movimientos. No cuenta
                    en tu saldo hasta que lo marques como {done}.
                </p>
            </div>
        </div>
    );
}

function nextDay(start: string, today: string): string {
    const date = new Date(`${start}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return today;
    }

    date.setUTCDate(date.getUTCDate() + 1);
    const after = date.toISOString().slice(0, 10);

    return after > today ? after : today;
}
