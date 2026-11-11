import { useEffect, useState } from 'react';
import { useFormat } from '@/hooks/use-format';
import { columnPath, compactNumber, niceTicks, useWidth } from './chart-utils';

export type ColumnSeries = { key: string; label: string; color: string };

type Props = {
    /** Una fila por categoría del eje X (p. ej. meses). Valores en texto decimal. */
    data: { key: string; label: string; values: Record<string, string> }[];
    series: ColumnSeries[];
    height?: number;
    ariaLabel: string;
};

const PADDING = { top: 12, right: 8, bottom: 28, left: 48 };

/**
 * Columnas agrupadas (≤ 24px, extremo redondeado, 2px entre columnas).
 * El grupo entero es la zona de puntero/foco y su aviso muestra todas las series.
 */
export function ColumnChart({ data, series, height = 220, ariaLabel }: Props) {
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const { ref, width } = useWidth<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);

    // El foco de teclado en grupos SVG no siempre llega a los manejadores de
    // React: se escucha el evento nativo en el contenedor.
    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const onFocusIn = (event: FocusEvent) => {
            const target = (event.target as Element).closest('[data-index]');
            setActive(
                target ? Number(target.getAttribute('data-index')) : null,
            );
        };
        const onFocusOut = () => setActive(null);

        element.addEventListener('focusin', onFocusIn);
        element.addEventListener('focusout', onFocusOut);

        return () => {
            element.removeEventListener('focusin', onFocusIn);
            element.removeEventListener('focusout', onFocusOut);
        };
    }, [ref]);

    const values = data.flatMap((row) =>
        series.map((s) => Number(row.values[s.key] ?? 0)),
    );
    const ticks = niceTicks(0, Math.max(...values, 0));
    const max = ticks[ticks.length - 1] || 1;

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    const band = plotWidth / Math.max(1, data.length);
    const gap = 2;
    const barWidth = Math.max(
        4,
        Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length),
    );
    const groupWidth = barWidth * series.length + gap * (series.length - 1);
    const y = (value: number) =>
        PADDING.top + plotHeight - (value / max) * plotHeight;

    const activeRow = active !== null ? data[active] : null;

    return (
        <div ref={ref} className="relative w-full min-w-0">
            <svg
                width={width}
                height={height}
                role="group"
                aria-label={ariaLabel}
                className="overflow-visible"
            >
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            x1={PADDING.left}
                            x2={width - PADDING.right}
                            y1={y(tick)}
                            y2={y(tick)}
                            className="stroke-border"
                            strokeWidth={1}
                        />
                        <text
                            x={PADDING.left - 8}
                            y={y(tick)}
                            dy="0.32em"
                            textAnchor="end"
                            className="fill-muted-foreground text-[11px]"
                        >
                            {compactNumber(tick, locale)}
                        </text>
                    </g>
                ))}

                {data.map((row, index) => {
                    const x0 =
                        PADDING.left + index * band + (band - groupWidth) / 2;

                    return (
                        <g
                            key={row.key}
                            tabIndex={0}
                            role="img"
                            aria-label={`${row.label}: ${series
                                .map(
                                    (s) =>
                                        `${s.label} ${format.money(row.values[s.key] ?? '0')}`,
                                )
                                .join(', ')}`}
                            data-index={index}
                            onPointerEnter={() => setActive(index)}
                            onPointerLeave={() => setActive(null)}
                            // El foco se ve con el sombreado de la banda activa.
                            className="outline-none"
                        >
                            {/* Zona de puntero: toda la banda, más grande que las columnas. */}
                            <rect
                                x={PADDING.left + index * band}
                                y={PADDING.top}
                                width={band}
                                height={plotHeight}
                                className={
                                    active === index
                                        ? 'fill-muted/60'
                                        : 'fill-transparent'
                                }
                            />
                            {series.map((s, si) => {
                                const value = Number(row.values[s.key] ?? 0);
                                const top = y(value);

                                return (
                                    <path
                                        key={s.key}
                                        d={columnPath(
                                            x0 + si * (barWidth + gap),
                                            top,
                                            barWidth,
                                            y(0) - top,
                                        )}
                                        style={{ fill: s.color }}
                                    />
                                );
                            })}
                            <text
                                x={PADDING.left + index * band + band / 2}
                                y={height - 8}
                                textAnchor="middle"
                                className="fill-muted-foreground text-[11px]"
                            >
                                {row.label}
                            </text>
                        </g>
                    );
                })}

                <line
                    x1={PADDING.left}
                    x2={width - PADDING.right}
                    y1={y(0)}
                    y2={y(0)}
                    className="stroke-muted-foreground/60"
                    strokeWidth={1}
                />
            </svg>

            {activeRow && active !== null && (
                <div
                    role="presentation"
                    className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
                    style={{
                        left: Math.min(
                            Math.max(
                                0,
                                PADDING.left + active * band + band / 2 - 72,
                            ),
                            width - 152,
                        ),
                    }}
                >
                    <p className="mb-1 text-muted-foreground">
                        {activeRow.label}
                    </p>
                    {series.map((s) => (
                        <p
                            key={s.key}
                            className="flex items-center justify-between gap-3"
                        >
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <span
                                    aria-hidden="true"
                                    className="h-0.5 w-3 rounded-full"
                                    style={{ background: s.color }}
                                />
                                {s.label}
                            </span>
                            <strong className="tabular-nums">
                                {format.money(activeRow.values[s.key] ?? '0')}
                            </strong>
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
