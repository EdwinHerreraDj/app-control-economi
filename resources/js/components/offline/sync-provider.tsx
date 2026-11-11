import { router, usePage } from '@inertiajs/react';
import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    bindUser,
    clearLocalData,
    getSyncState,
    syncNow,
    useSyncState,
} from '@/offline/sync';
import { logout } from '@/routes';

/** Tiempo mínimo entre sincronizaciones automáticas. */
const THROTTLE_MS = 60_000;

let lastAutoSync = 0;

function autoSync(force = false): void {
    if (!force && Date.now() - lastAutoSync < THROTTLE_MS) {
        return;
    }

    lastAutoSync = Date.now();
    void syncNow();
}

// Diálogo de cierre de sesión con cambios sin enviar.
let logoutDialogOpen = false;
const logoutListeners = new Set<() => void>();

function setLogoutDialog(open: boolean): void {
    logoutDialogOpen = open;
    logoutListeners.forEach((listener) => listener());
}

/**
 * Cierra la sesión borrando antes los datos guardados en el dispositivo. Si
 * hay movimientos sin enviar, pregunta primero. Devuelve false si se ha
 * abierto la pregunta (y el cierre debe esperar).
 */
export function beginLogout(): boolean {
    const { userId, pending, attention } = getSyncState();

    if (pending + attention > 0) {
        setLogoutDialog(true);

        return false;
    }

    if (userId !== null) {
        void clearLocalData(userId);
    }

    return true;
}

/**
 * Sincronización automática en las páginas con sesión: al abrir la app, al
 * recuperar la conexión, al volver a la pestaña y tras guardar cambios.
 */
export function SyncProvider() {
    const { auth } = usePage().props;
    const userId = auth.user?.id;
    const userName = auth.user?.name;

    useEffect(() => {
        if (userId === undefined || userName === undefined) {
            return;
        }

        void bindUser({ id: userId, name: userName }).then(() =>
            autoSync(true),
        );
    }, [userId, userName]);

    useEffect(() => {
        const onOnline = () => autoSync(true);
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                autoSync();
            }
        };

        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);

        // Tras guardar algo con conexión, la copia local se actualiza.
        let timer: number | undefined;
        const offFinish = router.on('finish', (event) => {
            if (event.detail.visit.method !== 'get') {
                window.clearTimeout(timer);
                timer = window.setTimeout(() => autoSync(true), 1500);
            }
        });

        // Una página que no carga por falta de conexión: se ofrece el modo
        // sin conexión en lugar de un error.
        const offNetwork = router.on('networkError', () => {
            toast.error('Sin conexión', {
                id: 'network-error',
                description:
                    'No se ha podido cargar. Puedes consultar tus datos y registrar movimientos en el modo sin conexión.',
                action: {
                    label: 'Abrir',
                    onClick: () => window.location.assign('/offline'),
                },
            });
        });

        return () => {
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisible);
            window.clearTimeout(timer);
            offFinish();
            offNetwork();
        };
    }, []);

    return <LogoutDialog />;
}

function LogoutDialog() {
    const open = useSyncExternalStore(
        (listener) => {
            logoutListeners.add(listener);

            return () => logoutListeners.delete(listener);
        },
        () => logoutDialogOpen,
        () => false,
    );
    const { userId, pending, attention, online, syncing } = useSyncState();
    const total = pending + attention;

    const proceed = async () => {
        if (userId !== null) {
            await clearLocalData(userId);
        }

        setLogoutDialog(false);
        router.flushAll();
        router.post(logout.url());
    };

    return (
        <Dialog open={open} onOpenChange={setLogoutDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tienes cambios sin enviar</DialogTitle>
                    <DialogDescription>
                        {total === 1
                            ? 'Hay 1 movimiento registrado en este dispositivo que aún no está en tu cuenta.'
                            : `Hay ${total} movimientos registrados en este dispositivo que aún no están en tu cuenta.`}{' '}
                        Al cerrar la sesión se borran los datos del dispositivo,
                        también esos movimientos.
                    </DialogDescription>
                </DialogHeader>
                {attention > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Algunos necesitan que los revises (en Configuración →
                        Dispositivo) antes de poder enviarse.
                    </p>
                )}
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button
                        variant="destructive"
                        onClick={() => void proceed()}
                    >
                        Descartar y cerrar sesión
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setLogoutDialog(false)}
                        >
                            Cancelar
                        </Button>
                        {pending > 0 && (
                            <Button
                                disabled={!online || syncing}
                                onClick={() => void syncNow()}
                            >
                                {syncing ? 'Enviando…' : 'Enviar ahora'}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
