import { useEffect, useRef, useState } from 'react';

/** Ancho real del contenedor, para dibujar el SVG a su tamaño (sin deformar textos). */
export function useWidth<T extends HTMLElement>(fallback = 320) {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(fallback);

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, width };
}

/** Marcas «redondas» para el eje: pasos de 1, 2, 2,5 o 5 × 10^n. */
export function niceTicks(min: number, max: number, count = 4): number[] {
    const low = Math.min(0, min);
    const high = Math.max(0, max);
    const span = high - low || 1;
    const raw = span / count;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step =
        [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ??
        10 * magnitude;

    const start = Math.floor(low / step) * step;
    const end = Math.ceil(high / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= end + step / 2; value += step) {
        ticks.push(Math.round(value * 100) / 100);
    }

    return ticks;
}

/** Etiquetas de eje compactas («1,5 mil», «20 mil») según el formato regional. */
export function compactNumber(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
        notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
        maximumFractionDigits: 1,
    }).format(value);
}

/** Mes «2026-11» como «nov.» o «noviembre 2026». */
export function monthLabel(
    month: string,
    locale: string,
    style: 'short' | 'long' = 'short',
): string {
    const [year, m] = month.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        month: style === 'short' ? 'short' : 'long',
        ...(style === 'long' ? { year: 'numeric' } : {}),
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, m - 1, 1)));
}

/**
 * Columna con el extremo de datos redondeado (4px) y la base recta,
 * apoyada en la línea base.
 */
export function columnPath(
    x: number,
    y: number,
    width: number,
    height: number,
): string {
    if (height <= 0) {
        return '';
    }

    const r = Math.min(4, width / 2, height);

    return [
        `M${x},${y + height}`,
        `V${y + r}`,
        `Q${x},${y} ${x + r},${y}`,
        `H${x + width - r}`,
        `Q${x + width},${y} ${x + width},${y + r}`,
        `V${y + height}`,
        'Z',
    ].join(' ');
}
