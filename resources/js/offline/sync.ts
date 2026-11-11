import { useSyncExternalStore } from 'react';
import {
    deleteOperation,
    deleteUserDatabase,
    getActiveUser,
    listOperations,
    newUuid,
    putOperation,
    readSnapshot,
    setActiveUser,
    storageAvailable,
    writeSnapshot,
} from '@/offline/storage';
import type { ActiveUser } from '@/offline/storage';
import type {
    OfflineSnapshot,
    PendingOperation,
    SyncProblem,
    SyncState,
    TransactionPayload,
} from '@/offline/types';

/**
 * Sincronización del modo sin conexión.
 *
 * Se ejecuta al abrir la app, al recuperar la conexión con la app activa y
 * cuando la persona lo pide; no depende de Background Sync. Primero envía lo
 * registrado en el dispositivo y después descarga los datos confirmados.
 */

const SNAPSHOT_URL = '/sync/snapshot';
const PUSH_URL = '/sync/operations';
const MEDIA_CACHE = 'media-v1';
const BATCH = 50;

let state: SyncState = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    syncing: false,
    userId: null,
    lastSyncedAt: null,
    pending: 0,
    attention: 0,
    problem: null,
    revision: 0,
};

const listeners = new Set<() => void>();
let running: Promise<void> | null = null;

function setState(changes: Partial<SyncState>): void {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

export function getSyncState(): SyncState {
    return state;
}

export function useSyncState(): SyncState {
    return useSyncExternalStore(subscribe, getSyncState, getSyncState);
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setState({ online: true }));
    window.addEventListener('offline', () => setState({ online: false }));
}

async function refresh(userId: number | null = state.userId): Promise<void> {
    if (userId === null || !storageAvailable()) {
        setState({
            userId,
            pending: 0,
            attention: 0,
            lastSyncedAt: null,
            revision: state.revision + 1,
        });

        return;
    }

    const [operations, snapshot] = await Promise.all([
        listOperations(userId),
        readSnapshot(userId),
    ]);

    setState({
        userId,
        pending: operations.filter((op) => op.state === 'pending').length,
        attention: operations.filter((op) => op.state !== 'pending').length,
        lastSyncedAt: snapshot?.generated_at ?? null,
        revision: state.revision + 1,
    });
}

/**
 * Usuario con sesión en esta página. Si el dispositivo lo usaba otra
 * persona, sus datos se borran (salvo cambios sin enviar, que se conservan
 * aparte y nunca se muestran a la cuenta actual).
 */
export async function bindUser(user: ActiveUser): Promise<void> {
    if (!storageAvailable()) {
        return;
    }

    const previous = getActiveUser();

    if (previous && previous.id !== user.id) {
        const leftovers = await listOperations(previous.id).catch(() => []);

        if (leftovers.length === 0) {
            await deleteUserDatabase(previous.id);
        }
    }

    setActiveUser({ id: user.id, name: user.name });
    setState({ problem: null });
    await refresh(user.id);
}

/** Usuario cuyos datos se muestran sin conexión (el último que entró). */
export async function bindStoredUser(): Promise<ActiveUser | null> {
    const user = getActiveUser();
    await refresh(user?.id ?? null);

    return user;
}

export async function loadLocalData(userId: number): Promise<{
    snapshot: OfflineSnapshot | null;
    operations: PendingOperation[];
}> {
    const [snapshot, operations] = await Promise.all([
        readSnapshot(userId),
        listOperations(userId),
    ]);

    return { snapshot, operations };
}

/** Borra todo lo guardado en el dispositivo para este usuario. */
export async function clearLocalData(userId: number): Promise<void> {
    await deleteUserDatabase(userId);

    if (getActiveUser()?.id === userId) {
        setActiveUser(null);
    }

    setState({
        userId: null,
        pending: 0,
        attention: 0,
        lastSyncedAt: null,
        problem: null,
        revision: state.revision + 1,
    });
}

export async function queueTransaction(
    userId: number,
    payload: TransactionPayload,
    labels: PendingOperation['labels'],
): Promise<PendingOperation> {
    const operation: PendingOperation = {
        uuid: newUuid(),
        type: 'transaction.create',
        payload,
        created_at: new Date().toISOString(),
        state: 'pending',
        errors: null,
        duplicate: null,
        confirm_duplicate: false,
        labels,
    };

    await putOperation(userId, operation);
    await refresh(userId);

    return operation;
}

/** Corrige un movimiento rechazado; se vuelve a enviar con el mismo id. */
export async function updateOperation(
    userId: number,
    operation: PendingOperation,
    payload: TransactionPayload,
    labels: PendingOperation['labels'],
): Promise<void> {
    await putOperation(userId, {
        ...operation,
        payload,
        labels,
        state: 'pending',
        errors: null,
        duplicate: null,
    });
    await refresh(userId);
}

/** «Registrar igualmente» un posible duplicado. */
export async function confirmDuplicate(
    userId: number,
    operation: PendingOperation,
): Promise<void> {
    await putOperation(userId, {
        ...operation,
        state: 'pending',
        errors: null,
        confirm_duplicate: true,
    });
    await refresh(userId);
}

export async function discardOperation(
    userId: number,
    uuid: string,
): Promise<void> {
    await deleteOperation(userId, uuid);
    await refresh(userId);
}

function csrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : null;
}

class SyncStop extends Error {
    constructor(public readonly problem: Exclude<SyncProblem, null>) {
        super(problem);
    }
}

async function request(url: string, init: RequestInit = {}): Promise<unknown> {
    const token = csrfToken();
    const response = await fetch(url, {
        ...init,
        credentials: 'same-origin',
        cache: 'no-store',
        // Una redirección (al acceso, al cambio de contraseña…) significa
        // que hay que abrir la app con conexión para continuar.
        redirect: 'manual',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        },
    });

    if (response.type === 'opaqueredirect' || response.status === 401) {
        throw new SyncStop('login');
    }

    if (response.status === 419) {
        throw new SyncStop('login');
    }

    if (response.status === 403) {
        const body = (await response.json().catch(() => null)) as {
            code?: string;
        } | null;

        throw new SyncStop(body?.code === 'inactive' ? 'inactive' : 'error');
    }

    if (response.status === 409) {
        throw new SyncStop('other-account');
    }

    if (!response.ok) {
        throw new SyncStop('error');
    }

    return response.json();
}

type PushResult = {
    uuid: string;
    status: 'applied' | 'rejected' | 'conflict';
    errors: Record<string, string[]> | null;
    duplicate: PendingOperation['duplicate'];
};

async function push(userId: number): Promise<boolean> {
    const pending = (await listOperations(userId)).filter(
        (op) => op.state === 'pending',
    );
    let applied = false;

    for (let index = 0; index < pending.length; index += BATCH) {
        const batch = pending.slice(index, index + BATCH);
        const body = (await request(PUSH_URL, {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                operations: batch.map((op) => ({
                    uuid: op.uuid,
                    type: op.type,
                    payload: op.payload,
                    created_at: op.created_at,
                    confirm_duplicate: op.confirm_duplicate,
                })),
            }),
        })) as { results: PushResult[] };

        for (const result of body.results) {
            const operation = batch.find((op) => op.uuid === result.uuid);

            if (!operation) {
                continue;
            }

            if (result.status === 'applied') {
                await deleteOperation(userId, operation.uuid);
                applied = true;
            } else {
                await putOperation(userId, {
                    ...operation,
                    state: result.status,
                    errors: result.errors,
                    duplicate: result.duplicate,
                });
            }
        }
    }

    return applied;
}

async function pull(userId: number): Promise<void> {
    const snapshot = (await request(SNAPSHOT_URL)) as OfflineSnapshot;

    // La sesión es de otra cuenta: no se mezclan sus datos con los de este
    // dispositivo.
    if (snapshot.user.id !== userId) {
        throw new SyncStop('other-account');
    }

    await writeSnapshot(userId, snapshot);
    void cacheMascot(snapshot);
}

/** Guarda las imágenes de la mascota para verlas sin conexión. */
async function cacheMascot(snapshot: OfflineSnapshot): Promise<void> {
    if (!snapshot.mascot || typeof caches === 'undefined') {
        return;
    }

    const urls = Object.values(snapshot.mascot.images)
        .map((image) => image.static)
        .filter((url): url is string => Boolean(url));

    try {
        const cache = await caches.open(MEDIA_CACHE);
        await Promise.all(
            urls.map(async (url) => {
                if (!(await cache.match(url))) {
                    await cache.add(url).catch(() => undefined);
                }
            }),
        );
    } catch {
        // Sin Cache API (p. ej. HTTP sin cifrar): la mascota se verá con conexión.
    }
}

async function runSync(): Promise<void> {
    const userId = state.userId ?? getActiveUser()?.id ?? null;

    if (userId === null || !storageAvailable() || !navigator.onLine) {
        return;
    }

    setState({ syncing: true });
    let cleared = false;

    try {
        await push(userId);
        await pull(userId);
        setState({ problem: null });
    } catch (error) {
        const problem = error instanceof SyncStop ? error.problem : 'error';

        // Cuenta suspendida o revocada: se aplica al reconectar borrando lo
        // guardado en el dispositivo.
        if (problem === 'inactive') {
            await clearLocalData(userId);
            cleared = true;
        }

        setState({ problem });
    } finally {
        if (!cleared) {
            await refresh(userId).catch(() => undefined);
        }

        setState({ syncing: false });
    }
}

/** Sincroniza ahora (si ya hay una en curso, espera a esa). */
export function syncNow(): Promise<void> {
    if (running) {
        return running;
    }

    // El bloqueo evita que dos pestañas envíen a la vez (si el navegador
    // no lo admite, el servidor igualmente ignora los reenvíos).
    const locks = 'locks' in navigator ? navigator.locks : null;
    const task: Promise<void> = locks
        ? locks.request('ep-sync', () => runSync()).then(() => undefined)
        : runSync();

    const current = task.finally(() => {
        running = null;
    });
    running = current;

    return current;
}
