import { router } from '@inertiajs/react';
import { toast } from 'sonner';

/**
 * Acción de un clic (archivar, confirmar, pausar...). Si el servidor la
 * rechaza, muestra el primer motivo como aviso.
 */
export function quickAction(url: string, method: 'post' | 'delete' = 'post') {
    router.visit(url, {
        method,
        preserveScroll: true,
        onError: (errors) => {
            const first = Object.values(errors)[0];

            if (first) {
                toast.error(first);
            }
        },
    });
}
