import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type LegendItem = {
    label: string;
    color: string;
    shape?: 'bar' | 'line';
};

type Props = {
    title: string;
    /** Resumen en texto: lo que el gráfico dice, para todo el mundo. */
    summary: ReactNode;
    legend?: LegendItem[];
    /** Tabla con los mismos datos (alternativa accesible). */
    table?: { columns: string[]; rows: ReactNode[][] };
    actions?: ReactNode;
    footer?: ReactNode;
    className?: string;
    children: ReactNode;
};

/**
 * Marco común de los gráficos: título, resumen textual, leyenda (solo con
 * dos o más series), el gráfico y la tabla de datos desplegable.
 */
export function ChartCard({
    title,
    summary,
    legend,
    table,
    actions,
    footer,
    className,
    children,
}: Props) {
    return (
        <section
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:p-5',
                className,
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                    <h2 className="font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground">{summary}</p>
                </div>
                {actions}
            </header>

            {legend && legend.length > 1 && (
                <ul
                    className="flex flex-wrap gap-4 text-xs text-muted-foreground"
                    aria-label="Leyenda"
                >
                    {legend.map((item) => (
                        <li
                            key={item.label}
                            className="flex items-center gap-1.5"
                        >
                            <span
                                aria-hidden="true"
                                className={
                                    item.shape === 'line'
                                        ? 'h-0.5 w-3 rounded-full'
                                        : 'size-2.5 rounded-sm'
                                }
                                style={{ background: item.color }}
                            />
                            {item.label}
                        </li>
                    ))}
                </ul>
            )}

            {children}

            {footer}

            {table && table.rows.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver los datos
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b text-muted-foreground">
                                    {table.columns.map((column, index) => (
                                        <th
                                            key={column}
                                            scope="col"
                                            className={cn(
                                                'py-1.5 pr-3 font-medium',
                                                index > 0 && 'text-right',
                                            )}
                                        >
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {table.rows.map((row, rowIndex) => (
                                    <tr
                                        key={rowIndex}
                                        className="border-b last:border-0"
                                    >
                                        {row.map((cell, index) =>
                                            index === 0 ? (
                                                <th
                                                    key={index}
                                                    scope="row"
                                                    className="py-1.5 pr-3 font-normal"
                                                >
                                                    {cell}
                                                </th>
                                            ) : (
                                                <td
                                                    key={index}
                                                    className="py-1.5 pr-3 text-right tabular-nums"
                                                >
                                                    {cell}
                                                </td>
                                            ),
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            )}
        </section>
    );
}
