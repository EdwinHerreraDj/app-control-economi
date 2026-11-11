import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Campos poco habituales, plegados para que el formulario muestre solo lo
 * esencial. Se abre solo si ya tienen datos o algún error.
 */
export function MoreOptions({
    open = false,
    children,
}: {
    open?: boolean;
    children: ReactNode;
}) {
    return (
        <details className="group rounded-lg border" open={open || undefined}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Más opciones
                <ChevronDown
                    className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                />
            </summary>
            <div className="grid gap-4 border-t p-3">{children}</div>
        </details>
    );
}
