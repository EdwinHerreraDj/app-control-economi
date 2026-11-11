import type { OfflineSnapshot, PendingOperation } from '@/offline/types';

/**
 * Almacenamiento local del modo sin conexión.
 *
 * Cada usuario tiene su propia base de datos de IndexedDB; al cerrar sesión
 * se borra entera. Solo se recuerda (en localStorage) qué usuario usó el
 * dispositivo por última vez, para abrir sus datos sin conexión.
 */

const PREFIX = 'ep-offline-';
const ACTIVE_USER_KEY = 'ep.offline.user';
const VERSION = 1;

export type ActiveUser = { id: number; name: string };

export function getActiveUser(): ActiveUser | null {
    try {
        const raw = window.localStorage.getItem(ACTIVE_USER_KEY);

        return raw ? (JSON.parse(raw) as ActiveUser) : null;
    } catch {
        return null;
    }
}

export function setActiveUser(user: ActiveUser | null): void {
    try {
        if (user) {
            window.localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
        } else {
            window.localStorage.removeItem(ACTIVE_USER_KEY);
        }
    } catch {
        // Almacenamiento bloqueado (modo privado estricto): sin modo offline.
    }
}

export function storageAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
}

function open(userId: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(`${PREFIX}${userId}`, VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta');
            }

            if (!db.objectStoreNames.contains('operations')) {
                db.createObjectStore('operations', { keyPath: 'uuid' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(
    userId: number,
    store: 'meta' | 'operations',
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await open(userId);

    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(store, mode);
            const request = action(transaction.objectStore(store));

            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        // Se cierra siempre: así borrar la base de datos nunca queda bloqueado.
        db.close();
    }
}

export async function readSnapshot(
    userId: number,
): Promise<OfflineSnapshot | null> {
    const value = await run<OfflineSnapshot | undefined>(
        userId,
        'meta',
        'readonly',
        (store) =>
            store.get('snapshot') as IDBRequest<OfflineSnapshot | undefined>,
    );

    return value ?? null;
}

export async function writeSnapshot(
    userId: number,
    snapshot: OfflineSnapshot,
): Promise<void> {
    await run(userId, 'meta', 'readwrite', (store) =>
        store.put(snapshot, 'snapshot'),
    );
}

export async function listOperations(
    userId: number,
): Promise<PendingOperation[]> {
    const items = await run<PendingOperation[]>(
        userId,
        'operations',
        'readonly',
        (store) => store.getAll() as IDBRequest<PendingOperation[]>,
    );

    return items.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function putOperation(
    userId: number,
    operation: PendingOperation,
): Promise<void> {
    await run(userId, 'operations', 'readwrite', (store) =>
        store.put(operation),
    );
}

export async function deleteOperation(
    userId: number,
    uuid: string,
): Promise<void> {
    await run(userId, 'operations', 'readwrite', (store) => store.delete(uuid));
}

export function deleteUserDatabase(userId: number): Promise<void> {
    return new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(`${PREFIX}${userId}`);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

/** Identificador único de la operación (también en contextos sin HTTPS). */
export function newUuid(): string {
    if (typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // randomUUID solo existe en contextos seguros.
        }
    }

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
