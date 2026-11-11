/**
 * Cálculo provisional del modo sin conexión: el saldo sincronizado más lo
 * registrado en el dispositivo. Se hace con enteros (unidad menor) y se
 * muestra siempre como provisional; el servidor lo recalcula al sincronizar.
 */
import type { PendingOperation } from '@/offline/types';

export function toMinor(decimal: string, decimals: number): number {
    const negative = decimal.trim().startsWith('-');
    const [whole, fraction = ''] = decimal
        .trim()
        .replace(/^[-+]/, '')
        .split('.');
    const minor =
        Number(whole || '0') * 10 ** decimals +
        Number((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');

    return negative ? -minor : minor;
}

export function fromMinor(minor: number, decimals: number): string {
    const negative = minor < 0;
    const digits = Math.abs(minor)
        .toString()
        .padStart(decimals + 1, '0');
    const whole = decimals > 0 ? digits.slice(0, -decimals) : digits;
    const fraction = decimals > 0 ? `.${digits.slice(-decimals)}` : '';

    return `${negative ? '-' : ''}${whole}${fraction}`;
}

/**
 * Efecto en el saldo de cada cuenta de lo pendiente ya cobrado o pagado
 * (los previstos no cambian el saldo real).
 */
export function pendingEffect(
    operations: PendingOperation[],
    decimals: number,
): Map<number, number> {
    const effect = new Map<number, number>();

    for (const { payload, state } of operations) {
        if (state !== 'pending' || payload.status !== 'confirmed') {
            continue;
        }

        const amount = toMinor(payload.amount, decimals);
        const signed = payload.kind === 'income' ? amount : -amount;
        effect.set(
            payload.account_id,
            (effect.get(payload.account_id) ?? 0) + signed,
        );
    }

    return effect;
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del usuario. */
export function todayIn(timeZone: string): string {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}
