import { CategoryIcon } from '@/components/finance/category-badge';
import { useFormat } from '@/hooks/use-format';

export type CategoryShare = {
    category: { id: number; name: string; icon: string; color: string };
    amount: string;
    share: number;
};

export type CategoryBreakdown = {
    total: string;
    rows: CategoryShare[];
    other: { count: number; amount: string; share: number } | null;
};

/**
 * Distribución por categorías como barras horizontales ordenadas (una sola
 * serie: un solo tono). La identidad la dan el icono y el nombre, no el color
 * de la barra. El servidor ya agrupa el resto en «Otras».
 */
export function CategoryBars({ breakdown }: { breakdown: CategoryBreakdown }) {
    const format = useFormat();
    const max =
        Math.max(...breakdown.rows.map((row) => Number(row.amount)), 0) || 1;

    return (
        <ul className="space-y-3">
            {breakdown.rows.map((row) => (
                <li key={row.category.id} className="flex items-center gap-3">
                    <CategoryIcon
                        icon={row.category.icon}
                        color={row.category.color}
                        className="size-8"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate">
                                {row.category.name}
                            </span>
                            <span className="shrink-0 tabular-nums">
                                <strong className="font-semibold">
                                    {format.money(row.amount)}
                                </strong>
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                    {format.percent(row.share)}
                                </span>
                            </span>
                        </div>
                        <div
                            className="h-1.5 rounded-full bg-muted"
                            aria-hidden="true"
                        >
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${(Number(row.amount) / max) * 100}%`,
                                    background: 'var(--series-1)',
                                }}
                            />
                        </div>
                    </div>
                </li>
            ))}
            {breakdown.other && (
                <li className="flex items-center justify-between gap-2 pl-11 text-sm text-muted-foreground">
                    <span>Otras {breakdown.other.count} categorías</span>
                    <span className="tabular-nums">
                        {format.money(breakdown.other.amount)} ·{' '}
                        {format.percent(breakdown.other.share)}
                    </span>
                </li>
            )}
        </ul>
    );
}
