import { Head, usePage } from '@inertiajs/react';
import { CloudOff, Download, RefreshCw, Share, SquarePlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/heading';
import { PendingOperations } from '@/components/offline/pending-operations';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useFormat } from '@/hooks/use-format';
import { isIos, promptInstall, useInstallState } from '@/offline/pwa';
import {
    bindUser,
    clearLocalData,
    syncNow,
    useSyncState,
} from '@/offline/sync';
import { useLocalData } from '@/offline/use-local-data';
import { edit } from '@/routes/device';

function InstallSection() {
    const { canPrompt, installed } = useInstallState();
    const secure = window.isSecureContext;

    return (
        <section className="space-y-3">
            <Heading
                variant="small"
                title="Instalar la app"
                description="Ábrela como una aplicación más, a pantalla completa y desde el icono de tu dispositivo."
            />

            {installed ? (
                <p className="text-sm">
                    Ya la estás usando como aplicación instalada.
                </p>
            ) : canPrompt ? (
                <Button
                    onClick={() =>
                        void promptInstall().then((accepted) => {
                            if (accepted) {
                                toast.success('App instalada.');
                            }
                        })
                    }
                >
                    <Download aria-hidden />
                    Instalar
                </Button>
            ) : isIos() ? (
                <ol className="list-inside list-decimal space-y-1 text-sm">
                    <li>
                        Abre esta página en Safari y pulsa{' '}
                        <Share
                            className="inline size-4 align-text-bottom"
                            aria-label="Compartir"
                        />{' '}
                        (Compartir).
                    </li>
                    <li>
                        Elige{' '}
                        <span className="font-medium">
                            Añadir a pantalla de inicio
                        </span>{' '}
                        <SquarePlus
                            className="inline size-4 align-text-bottom"
                            aria-hidden
                        />
                        .
                    </li>
                    <li>Confirma con «Añadir».</li>
                </ol>
            ) : (
                <div className="space-y-2 text-sm">
                    <p>
                        En Chrome o Edge, usa el icono de instalar de la barra
                        de direcciones o el menú del navegador →{' '}
                        <span className="font-medium">Instalar aplicación</span>
                        . En Android: menú ⋮ →{' '}
                        <span className="font-medium">
                            Añadir a pantalla de inicio
                        </span>
                        .
                    </p>
                    <p className="text-muted-foreground">
                        Algunos navegadores (como Firefox en escritorio) no
                        permiten instalarla; puedes seguir usándola desde el
                        navegador.
                    </p>
                </div>
            )}

            {!secure && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                    La instalación y el modo sin conexión necesitan una conexión
                    segura (HTTPS).
                </p>
            )}
        </section>
    );
}

export default function DeviceSettings() {
    const { auth } = usePage().props;
    const { online, syncing, lastSyncedAt, pending, attention, problem } =
        useSyncState();
    const { snapshot, operations } = useLocalData(auth.user.id);
    const format = useFormat();
    const [confirmClear, setConfirmClear] = useState(false);
    const unsent = pending + attention;

    return (
        <>
            <Head title="Dispositivo" />
            <h1 className="sr-only">Dispositivo</h1>

            <div className="space-y-10">
                <InstallSection />

                <section className="space-y-3">
                    <Heading
                        variant="small"
                        title="Sincronización"
                        description="Se sincroniza al abrir la app, al recuperar la conexión y cuando lo pides. Primero se envía lo registrado sin conexión y después se descargan tus datos confirmados."
                    />
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                        <dt className="text-muted-foreground">Conexión</dt>
                        <dd>{online ? 'Con conexión' : 'Sin conexión'}</dd>
                        <dt className="text-muted-foreground">
                            Última sincronización
                        </dt>
                        <dd>
                            {lastSyncedAt
                                ? `${format.dateTime(lastSyncedAt)} (${format.relative(lastSyncedAt)})`
                                : 'Todavía no'}
                        </dd>
                        <dt className="text-muted-foreground">Pendientes</dt>
                        <dd>
                            {pending} sin enviar · {attention} por revisar
                        </dd>
                    </dl>
                    {problem === 'error' && (
                        <p className="text-sm text-destructive">
                            La última sincronización falló. Se volverá a
                            intentar automáticamente.
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            disabled={!online || syncing}
                            onClick={() => void syncNow()}
                        >
                            <RefreshCw aria-hidden />
                            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                        </Button>
                        <Button variant="ghost" asChild>
                            <a href="/offline">
                                <CloudOff aria-hidden />
                                Abrir modo sin conexión
                            </a>
                        </Button>
                    </div>

                    {snapshot && operations.length > 0 && (
                        <PendingOperations
                            userId={auth.user.id}
                            snapshot={snapshot}
                            operations={operations}
                        />
                    )}
                </section>

                <section className="space-y-3">
                    <Heading
                        variant="small"
                        title="Qué funciona sin conexión"
                        description="Tras iniciar sesión y sincronizar una vez en este dispositivo:"
                    />
                    <ul className="list-inside list-disc space-y-1 text-sm">
                        <li>
                            Abrir la app y consultar saldos, próximos pagos y
                            los últimos movimientos sincronizados.
                        </li>
                        <li>
                            Registrar ingresos y gastos: quedan pendientes y se
                            envían al recuperar la conexión.
                        </li>
                        <li>
                            Necesitan conexión: transferencias, deudas,
                            presupuestos, objetivos, estadísticas,
                            administración y recuperar la contraseña.
                        </li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <Heading
                        variant="small"
                        title="Datos en este dispositivo"
                        description="Se guarda una copia de consulta de tus cuentas, categorías y movimientos recientes, separada por usuario. Se borra al cerrar sesión."
                    />
                    <Button
                        variant="outline"
                        onClick={() => setConfirmClear(true)}
                    >
                        Borrar datos de este dispositivo
                    </Button>
                </section>
            </div>

            <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            ¿Borrar los datos de este dispositivo?
                        </DialogTitle>
                        <DialogDescription>
                            Tu cuenta no cambia: solo se borra la copia guardada
                            aquí. Se volverá a descargar al sincronizar.
                            {unsent > 0 &&
                                ` Atención: ${unsent === 1 ? 'hay 1 movimiento sin enviar que se perderá' : `hay ${unsent} movimientos sin enviar que se perderán`}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost">Cancelar</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                void clearLocalData(auth.user.id).then(() => {
                                    // Sigue siendo el usuario del dispositivo:
                                    // la próxima sincronización lo descarga.
                                    void bindUser({
                                        id: auth.user.id,
                                        name: auth.user.name,
                                    });
                                    setConfirmClear(false);
                                    toast.success(
                                        'Datos del dispositivo borrados.',
                                    );
                                })
                            }
                        >
                            Borrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

DeviceSettings.layout = {
    breadcrumbs: [{ title: 'Dispositivo', href: edit() }],
};
