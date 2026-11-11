import type { KeyboardEvent, PointerEvent } from 'react';
import { useMemo, useState } from 'react';
import { useFormat } from '@/hooks/use-format';
import { compactNumber, monthLabel, niceTicks, useWidth } from './chart-utils';

type Point = { date: string; value: string };

type Props = {
    points: Point[];
    ariaLabel: string;
    /** Escalonada: el saldo cambia de golpe en cada fecha (previsión de liquidez). */
    step?: boolean;
    /** Marca y etiqueta el punto más bajo. */
    markLowest?: boolean;
    /** Fechas «YYYY-MM» (meses) en lugar de días. */
    monthly?: boolean;
    height?: number;
    color?: string;
};

const PADDING = { top: 16, right: 16, bottom: 28, left: 52 };

function dayNumber(date: string): number {
    const [y, m, d = 1] = date.split('-').map(Number);

    return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Línea de 2px con un velo del 10 %, línea de cero destacada y cursor que
 * se ajusta al punto más cercano (también con las flechas del teclado).
 */
export function BalanceLineChart({
    points,
    ariaLabel,
    step = false,
    markLowest = false,
    monthly = false,
    height = 220,
    color = 'var(--series-1)',
}: Props) {
    const format = useFormat();
    const locale = format.preferences.number_locale;
    const { ref, width } = useWidth<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);

    const parsed = useMemo(
        () =>
            points.map((p) => ({
                ...p,
                x: dayNumber(p.date),
                v: Number(p.value),
            })),
        [points],
    );

    if (parsed.length === 0) {
        return null;
    }

    const values = parsed.map((p) => p.v);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    const x0 = parsed[0].x;
    const x1 = parsed[parsed.length - 1].x;
    const sx = (x: number) =>
        PADDING.left +
        (x1 === x0 ? plotWidth / 2 : ((x - x0) / (x1 - x0)) * plotWidth);
    const sy = (v: number) =>
        PADDING.top + plotHeight - ((v - min) / (max - min || 1)) * plotHeight;

    let line = '';
    parsed.forEach((p, i) => {
        if (i === 0) {
            line = `M${sx(p.x)},${sy(p.v)}`;
        } else if (step) {
            line += ` H${sx(p.x)} V${sy(p.v)}`;
        } else {
            line += ` L${sx(p.x)},${sy(p.v)}`;
        }
    });
    const baseline = sy(Math.max(min, Math.min(0, max)));
    const area = `${line} V${baseline} H${sx(x0)} Z`;

    const lowestIndex = values.indexOf(Math.min(...values));
    const formatDate = (date: string) =>
        monthly ? monthLabel(date, locale, 'long') : format.day(date);

    const nearest = (clientX: number, rect: DOMRect) => {
        const x = clientX - rect.left;
        let best = 0;
        parsed.forEach((p, i) => {
            if (Math.abs(sx(p.x) - x) < Math.abs(sx(parsed[best].x) - x)) {
                best = i;
            }
        });

        return best;
    };

    const onPointerMove = (event: PointerEvent<SVGSVGElement>) =>
        setActive(
            nearest(event.clientX, event.currentTarget.getBoundingClientRect()),
        );

    const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const delta = event.key === 'ArrowRight' ? 1 : -1;
            setActive((current) =>
                Math.max(
                    0,
                    Math.min(
                        parsed.length - 1,
                        (current ?? (delta > 0 ? -1 : parsed.length)) + delta,
                    ),
                ),
            );
        }
    };

    const current = active !== null ? parsed[active] : null;
    const last = parsed[parsed.length - 1];

    return (
        <div ref={ref} className="relative w-full min-w-0">
            <svg
                width={width}
                height={height}
                role="img"
                aria-label={`${ariaLabel}. Usa las flechas izquierda y derecha para recorrer los valores.`}
                tabIndex={0}
                onPointerMove={onPointerMove}
                onPointerLeave={() => setActive(null)}
                onKeyDown={onKeyDown}
                onBlur={() => setActive(null)}
                className="overflow-visible rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
            >
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            x1={PADDING.left}
                            x2={width - PADDING.right}
                            y1={sy(tick)}
                            y2={sy(tick)}
                            className={
                                tick === 0
                                    ? 'stroke-muted-foreground/70'
                                    : 'stroke-border'
                            }
                            strokeWidth={1}
                        />
                        <text
                            x={PADDING.left - 8}
                            y={sy(tick)}
                            dy="0.32em"
                            textAnchor="end"
                            className="fill-muted-foreground text-[11px]"
                        >
                            {compactNumber(tick, locale)}
                        </text>
                    </g>
                ))}

                <path d={area} style={{ fill: color, opacity: 0.1 }} />
                <path
                    d={line}
                    fill="none"
                    style={{ stroke: color }}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                <text
                    x={PADDING.left}
                    y={height - 8}
                    className="fill-muted-foreground text-[11px]"
                >
                    {formatDate(parsed[0].date)}
                </text>
                <text
                    x={width - PADDING.right}
                    y={height - 8}
                    textAnchor="end"
                    className="fill-muted-foreground text-[11px]"
                >
                    {formatDate(last.date)}
                </text>

                {/* Etiqueta selectiva: valor final. */}
                <circle
                    cx={sx(last.x)}
                    cy={sy(last.v)}
                    r={4}
                    style={{ fill: color }}
                    className="stroke-card"
                    strokeWidth={2}
                />

                {markLowest &&
                    lowestIndex !== parsed.length - 1 &&
                    lowestIndex !== 0 && (
                        <g>
                            <circle
                                cx={sx(parsed[lowestIndex].x)}
                                cy={sy(parsed[lowestIndex].v)}
                                r={4}
                                style={{ fill: color }}
                                className="stroke-card"
                                strokeWidth={2}
                            />
                            <text
                                x={sx(parsed[lowestIndex].x)}
                                y={sy(parsed[lowestIndex].v) + 18}
                                textAnchor="middle"
                                className="fill-foreground text-[11px] font-medium"
                            >
                                Mínimo {format.money(parsed[lowestIndex].value)}
                            </text>
                        </g>
                    )}

                {current && (
                    <g pointerEvents="none">
                        <line
                            x1={sx(current.x)}
                            x2={sx(current.x)}
                            y1={PADDING.top}
                            y2={PADDING.top + plotHeight}
                            className="stroke-muted-foreground/50"
                            strokeWidth={1}
                        />
                        <circle
                            cx={sx(current.x)}
                            cy={sy(current.v)}
                            r={5}
                            style={{ fill: color }}
                            className="stroke-card"
                            strokeWidth={2}
                        />
                    </g>
                )}
            </svg>

            {current && (
                <div
                    aria-live="polite"
                    className="pointer-events-none absolute top-0 z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
                    style={{
                        left: Math.min(
                            Math.max(0, sx(current.x) - 70),
                            width - 150,
                        ),
                    }}
                >
                    <strong className="block text-sm tabular-nums">
                        {format.money(current.value)}
                    </strong>
                    <span className="text-muted-foreground">
                        {formatDate(current.date)}
                    </span>
                </div>
            )}
        </div>
    );
}
