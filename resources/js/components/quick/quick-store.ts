import { useSyncExternalStore } from 'react';

/**
 * Estado global del botón «+»: qué formulario rápido está abierto. Un solo
 * panel que cambia de contenido (nunca diálogos encadenados).
 */
export type QuickView = 'menu' | 'expense' | 'income' | 'savings' | null;

let view: QuickView = null;
let presetCategory: number | null = null;
const listeners = new Set<() => void>();

/**
 * Abre el panel. Con una categoría, el formulario llega ya con ella elegida
 * (al tocar su icono en «Gastos» o «Ingresos»).
 */
export function openQuick(
    next: Exclude<QuickView, null> = 'menu',
    categoryId: number | null = null,
): void {
    view = next;
    presetCategory = categoryId;
    listeners.forEach((listener) => listener());
}

export function quickPresetCategory(): number | null {
    return presetCategory;
}

export function closeQuick(): void {
    view = null;
    listeners.forEach((listener) => listener());
}

export function useQuickView(): QuickView {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => view,
        () => null,
    );
}

/** Datos de los formularios rápidos (se piden al abrirlos). */
export type QuickData = {
    today: string;
    accounts: {
        id: number;
        name: string;
        type: string;
        savings: boolean;
        balance: string;
    }[];
    categories: {
        id: number;
        kind: 'income' | 'expense';
        name: string;
        icon: string;
        color: string;
    }[];
    keywords: Record<
        'income' | 'expense',
        { category_id: number; words: string[] }[]
    >;
    history: Record<
        'income' | 'expense',
        { concept: string; category_id: number }[]
    >;
    fallback: Record<'income' | 'expense', number | null>;
    pending: {
        id: number;
        kind: 'income' | 'expense';
        concept: string;
        amount: string;
        date: string;
        category_id: number | null;
        account_id: number;
    }[];
};

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Texto comparable: minúsculas y sin tildes. */
export function plain(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
}

/**
 * Categoría sugerida para lo que escribe la persona: primero su historial,
 * luego las palabras clave. Siempre se puede cambiar.
 */
export function suggestCategory(
    data: QuickData,
    kind: 'income' | 'expense',
    concept: string,
): number | null {
    const text = ` ${plain(concept)} `;

    if (text.trim() === '') {
        return null;
    }

    const known = data.history[kind].find(
        (item) => plain(item.concept) === text.trim(),
    );

    if (known) {
        return known.category_id;
    }

    for (const entry of data.keywords[kind]) {
        // Palabra completa (o su plural): «gas» no coincide con «gasolina».
        if (
            entry.words.some((word) =>
                new RegExp(`(^|\\s)${escape(plain(word))}(s|es)?(\\s|$)`).test(
                    text,
                ),
            )
        ) {
            return entry.category_id;
        }
    }

    return null;
}

/**
 * ¿Lo que se está apuntando es un cobro o pago que ya estaba pendiente?
 * Así no se duplica: se confirma ese.
 */
export function matchPending(
    data: QuickData,
    kind: 'income' | 'expense',
    concept: string,
    categoryId: number | null,
    amount: number | null,
): QuickData['pending'][number] | null {
    const text = plain(concept);

    return (
        data.pending.find((item) => {
            if (item.kind !== kind) {
                return false;
            }

            const name = plain(item.concept);
            const similarName =
                text.length >= 3 &&
                (name.includes(text) || text.includes(name));
            const expected = Number(item.amount);
            const closeAmount =
                amount !== null &&
                expected > 0 &&
                Math.abs(amount - expected) <= expected * 0.3;

            return (
                similarName ||
                (categoryId !== null &&
                    item.category_id === categoryId &&
                    closeAmount)
            );
        }) ?? null
    );
}
