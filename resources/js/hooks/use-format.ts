import { usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import {
    formatDate,
    formatDateTime,
    formatDay,
    formatMoney,
    formatRelative,
} from '@/lib/format';

/**
 * Formateadores ligados a las preferencias del usuario con sesión.
 */
export function useFormat() {
    const { preferences } = usePage().props;

    return useMemo(
        () => ({
            preferences,
            money: (amount: string | number, currency?: string | null) =>
                formatMoney(
                    amount,
                    preferences,
                    currency ?? preferences.currency,
                ),
            dateTime: (value: string | null | undefined) =>
                formatDateTime(value, preferences),
            date: (value: string | null | undefined) =>
                formatDate(value, preferences),
            day: (value: string | null | undefined) =>
                formatDay(value, preferences),
            relative: (value: string | null | undefined) =>
                formatRelative(value, preferences),
        }),
        [preferences],
    );
}
