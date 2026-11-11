import { Info } from 'lucide-react';

/**
 * «¿Cómo se calcula?»: período, datos y supuestos de una estimación.
 * Las estimaciones nunca se presentan sin poder ver de dónde salen.
 */
export function Explanation({
    items,
    title = '¿Cómo se calcula?',
}: {
    items: string[];
    title?: string;
}) {
    if (items.length === 0) {
        return null;
    }

    return (
        <details className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <summary className="flex cursor-pointer items-center gap-1.5 hover:text-foreground">
                <Info className="size-3.5" aria-hidden="true" />
                {title}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
            <p className="mt-2">
                Es una estimación orientativa, no una garantía.
            </p>
        </details>
    );
}
