import { Link } from '@inertiajs/react';
import { CloudUpload } from 'lucide-react';
import { useSyncState } from '@/offline/sync';
import { edit as editDevice } from '@/routes/device';

/**
 * Distingue en el panel lo pendiente de sincronizar: los datos mostrados
 * son los confirmados en el servidor y aún no incluyen esos movimientos.
 */
export function PendingSyncNotice() {
    const { pending, attention } = useSyncState();
    const total = pending + attention;

    if (total === 0) {
        return null;
    }

    return (
        <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed px-4 py-3 text-sm"
        >
            <CloudUpload className="size-4 shrink-0" aria-hidden />
            <p className="flex-1">
                {total === 1
                    ? 'Tienes 1 movimiento registrado sin conexión que aún no aparece en estos datos.'
                    : `Tienes ${total} movimientos registrados sin conexión que aún no aparecen en estos datos.`}
                {attention > 0 &&
                    ` ${attention === 1 ? 'Uno necesita' : `${attention} necesitan`} que lo revises.`}
            </p>
            <Link
                href={editDevice()}
                className="font-medium text-primary underline-offset-4 hover:underline"
            >
                Revisar
            </Link>
        </div>
    );
}
