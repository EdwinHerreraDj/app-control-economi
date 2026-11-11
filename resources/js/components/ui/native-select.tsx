import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Select nativo con el aspecto de los campos de la app. Preferible a un
 * desplegable personalizado en listas largas y en móvil: el sistema ofrece
 * su propio selector, búsqueda por teclado y lectores de pantalla.
 */
function NativeSelect({
    className,
    children,
    ...props
}: React.ComponentProps<'select'>) {
    return (
        <div className="relative">
            <select
                data-slot="native-select"
                className={cn(
                    'flex h-10 w-full appearance-none rounded-md border border-input bg-transparent py-2 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
                    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30',
                    className,
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
        </div>
    );
}

export { NativeSelect };
