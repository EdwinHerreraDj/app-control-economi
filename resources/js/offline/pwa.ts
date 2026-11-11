import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';

/**
 * Registro del service worker, aviso de nuevas versiones e instalación.
 */

type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

export function isStandalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export function isIos(): boolean {
    const ua = navigator.userAgent;

    return (
        /iphone|ipad|ipod/i.test(ua) ||
        (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    );
}

type InstallState = {
    canPrompt: boolean;
    installed: boolean;
};

let snapshot: InstallState = { canPrompt: false, installed: false };

function readInstallState(): InstallState {
    const next = {
        canPrompt: installPrompt !== null,
        installed: installed || isStandalone(),
    };

    if (
        next.canPrompt !== snapshot.canPrompt ||
        next.installed !== snapshot.installed
    ) {
        snapshot = next;
    }

    return snapshot;
}

export function useInstallState(): InstallState {
    return useSyncExternalStore(subscribe, readInstallState, readInstallState);
}

/** Muestra el diálogo de instalación del navegador (Chrome, Edge, Android). */
export async function promptInstall(): Promise<boolean> {
    if (!installPrompt) {
        return false;
    }

    const event = installPrompt;
    installPrompt = null;
    await event.prompt();
    const choice = await event.userChoice;
    notify();

    return choice.outcome === 'accepted';
}

let updateRequested = false;

function offerUpdate(worker: ServiceWorker): void {
    toast('Hay una versión nueva de la app', {
        id: 'app-update',
        description:
            'Actualiza cuando termines lo que estás haciendo: la página se recargará.',
        duration: Infinity,
        action: {
            label: 'Actualizar',
            onClick: () => {
                updateRequested = true;
                worker.postMessage({ type: 'SKIP_WAITING' });
            },
        },
    });
}

export function setupPwa(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
        // Se guarda para ofrecer la instalación desde Configuración.
        event.preventDefault();
        installPrompt = event as InstallPromptEvent;
        notify();
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        installed = true;
        notify();
    });

    // En desarrollo (servidor de Vite) no hay compilación que guardar.
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
        return;
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Solo se recarga si la persona pidió actualizar.
        if (updateRequested) {
            window.location.reload();
        }
    });

    const register = async () => {
        try {
            const registration = await navigator.serviceWorker.register(
                '/sw.js',
                { scope: '/' },
            );

            if (registration.waiting && navigator.serviceWorker.controller) {
                offerUpdate(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;

                worker?.addEventListener('statechange', () => {
                    if (
                        worker.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        offerUpdate(worker);
                    }
                });
            });

            // Comprueba si hay versión nueva cada hora con la app abierta.
            window.setInterval(
                () => void registration.update().catch(() => undefined),
                60 * 60 * 1000,
            );
        } catch {
            // Sin HTTPS o con el almacenamiento bloqueado: la app funciona
            // igual, pero sin modo sin conexión.
        }
    };

    if (document.readyState === 'complete') {
        void register();
    } else {
        window.addEventListener('load', () => void register(), { once: true });
    }
}
