import type { FormatPreferences } from '@/lib/format';
import type { MascotImages } from '@/types/branding';

/** Copia de consulta que el servidor prepara para usar la app sin conexión. */
export type OfflineSnapshot = {
    user: { id: number; name: string };
    preferences: FormatPreferences;
    generated_at: string;
    today: string;
    balance: string;
    accounts: {
        id: number;
        name: string;
        type: string;
        currency: string;
        archived: boolean;
        balance: string;
    }[];
    categories: {
        id: number;
        kind: 'income' | 'expense';
        name: string;
        icon: string;
        color: string;
    }[];
    recent: {
        uuid: string;
        kind: string;
        status: 'planned' | 'confirmed';
        amount: string;
        currency: string;
        occurred_on: string;
        concept: string;
        account: string;
        category: { name: string; icon: string; color: string } | null;
    }[];
    upcoming: {
        type: 'movement' | 'debt';
        id: number;
        kind: string;
        date: string | null;
        overdue: boolean;
        concept: string;
        amount: string | null;
        account: string | null;
    }[];
    mascot: {
        name: string;
        images: MascotImages;
        visibility: 'shown' | 'minimized' | 'hidden';
        motion: 'full' | 'reduced' | 'none';
    } | null;
};

export type TransactionPayload = {
    kind: 'income' | 'expense';
    account_id: number;
    category_id: number;
    /** Decimal con punto («12.50»). */
    amount: string;
    occurred_on: string;
    status: 'planned' | 'confirmed';
    concept: string;
    notes: string | null;
};

/**
 * Ingreso o gasto registrado en el dispositivo y aún no aplicado.
 *
 * - pending: espera a enviarse.
 * - rejected: el servidor no lo ha aceptado (p. ej. cuenta archivada).
 * - conflict: parece duplicado; la persona decide.
 */
export type PendingOperation = {
    uuid: string;
    type: 'transaction.create';
    payload: TransactionPayload;
    created_at: string;
    state: 'pending' | 'rejected' | 'conflict';
    errors: Record<string, string[]> | null;
    duplicate: { concept: string; occurred_on: string; amount: string } | null;
    confirm_duplicate: boolean;
    /** Nombres para mostrarlo sin conexión. */
    labels: { account: string; category: string };
};

export type SyncProblem =
    | 'login'
    | 'other-account'
    | 'inactive'
    | 'error'
    | null;

export type SyncState = {
    online: boolean;
    syncing: boolean;
    userId: number | null;
    lastSyncedAt: string | null;
    /** Pendientes de enviar. */
    pending: number;
    /** Rechazados o en conflicto: necesitan una decisión. */
    attention: number;
    problem: SyncProblem;
    /** Cambia con cada modificación de los datos locales. */
    revision: number;
};
