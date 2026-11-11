import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Cloud,
    CloudOff,
    CloudUpload,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFormat } from '@/hooks/use-format';
import { cn } from '@/lib/utils';
import { syncNow, useSyncState } from '@/offline/sync';
import { edit as editDevice } from '@/routes/device';

/**
 * Estado de la conexión y de la sincronización, siempre visible en la
 * cabecera: sin conexión, pendientes, por revisar o al día.
 */
export function SyncStatus() {
    const { online, syncing, pending, attention, lastSyncedAt, problem } =
        useSyncState();
    const format = useFormat();

    const status = !online
        ? {
              icon: CloudOff,
              text: 'Sin conexión',
              tone: 'text-amber-700 dark:text-amber-400',
          }
        : attention > 0
          ? {
                icon: AlertTriangle,
                text: `${attention} por revisar`,
                tone: 'text-destructive',
            }
          : pending > 0
            ? {
                  icon: CloudUpload,
                  text: `${pending} sin enviar`,
                  tone: 'text-foreground',
              }
            : syncing
              ? {
                    icon: RefreshCw,
                    text: 'Sincronizando…',
                    tone: 'text-muted-foreground',
                }
              : {
                    icon: Cloud,
                    text: 'Al día',
                    tone: 'text-muted-foreground',
                };
    const Icon = status.icon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn('gap-1.5', status.tone)}
                    aria-label={`Sincronización: ${status.text}`}
                    data-test="sync-status"
                >
                    <Icon
                        className={cn(
                            'size-4',
                            syncing && online && 'motion-safe:animate-spin',
                        )}
                        aria-hidden
                    />
                    <span
                        className={cn(
                            'text-xs',
                            online &&
                                attention + pending === 0 &&
                                'max-sm:sr-only',
                        )}
                    >
                        {status.text}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="space-y-1 font-normal">
                    <span className="block text-sm font-medium">
                        {online ? 'Con conexión' : 'Sin conexión'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                        {lastSyncedAt
                            ? `Datos del dispositivo actualizados ${format.relative(lastSyncedAt)}.`
                            : 'Aún no hay datos guardados en este dispositivo.'}
                    </span>
                    {pending > 0 && (
                        <span className="block text-xs">
                            {pending === 1
                                ? '1 movimiento registrado sin conexión pendiente de enviar.'
                                : `${pending} movimientos registrados sin conexión pendientes de enviar.`}
                        </span>
                    )}
                    {attention > 0 && (
                        <span className="block text-xs text-destructive">
                            {attention === 1
                                ? '1 movimiento necesita que lo revises.'
                                : `${attention} movimientos necesitan que los revises.`}
                        </span>
                    )}
                    {problem === 'login' && (
                        <span className="block text-xs text-destructive">
                            Vuelve a iniciar sesión para sincronizar.
                        </span>
                    )}
                    {problem === 'error' && online && (
                        <span className="block text-xs text-destructive">
                            La última sincronización falló. Se reintentará.
                        </span>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={!online || syncing}
                    onSelect={() => void syncNow()}
                >
                    <RefreshCw aria-hidden />
                    Sincronizar ahora
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <a href="/offline">
                        <CloudOff aria-hidden />
                        Abrir modo sin conexión
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={editDevice()}>
                        <Cloud aria-hidden />
                        Detalles y pendientes
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
