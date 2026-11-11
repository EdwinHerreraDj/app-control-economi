import { cn } from '@/lib/utils';

type Props = {
    /** Porcentaje (puede superar 100; la barra se limita visualmente). */
    value: number;
    label: string;
    /** Texto para lectores de pantalla, p. ej. «250 € de 300 €». */
    valueText?: string;
    tone?: 'default' | 'warning' | 'done';
    className?: string;
};

/**
 * Barra de progreso accesible. El estado se comunica también con texto
 * en la interfaz: el color nunca es la única señal.
 */
export function ProgressBar({
    value,
    label,
    valueText,
    tone = 'default',
    className,
}: Props) {
    const width = Math.max(0, Math.min(100, value));

    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(width)}
            aria-valuetext={valueText}
            className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
        >
            <div
                className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    tone === 'warning' && 'bg-amber-500',
                    tone === 'done' && 'bg-emerald-500',
                    tone === 'default' && 'bg-primary',
                )}
                style={{ width: `${width}%` }}
            />
        </div>
    );
}
