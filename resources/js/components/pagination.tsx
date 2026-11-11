import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import type { Paginated } from '@/types';

function cleanLabel(label: string): string {
    // Laravel envía las etiquetas traducidas con entidades HTML («&laquo;»).
    return label
        .replace('&laquo;', '←')
        .replace('&raquo;', '→')
        .replace(/&[a-z]+;/g, '')
        .trim();
}

export function Pagination<T>({ page }: { page: Paginated<T> }) {
    if (page.last_page <= 1) {
        return null;
    }

    return (
        <nav
            aria-label="Paginación"
            className="flex flex-wrap items-center justify-between gap-2"
        >
            <p className="text-sm text-muted-foreground">
                {page.from}–{page.to} de {page.total}
            </p>
            <div className="flex flex-wrap gap-1">
                {page.links.map((link, index) =>
                    link.url ? (
                        <Button
                            key={index}
                            asChild
                            size="sm"
                            variant={link.active ? 'default' : 'outline'}
                        >
                            <Link
                                href={link.url}
                                preserveScroll
                                aria-current={link.active ? 'page' : undefined}
                            >
                                {cleanLabel(link.label)}
                            </Link>
                        </Button>
                    ) : (
                        <Button
                            key={index}
                            size="sm"
                            variant="outline"
                            disabled
                        >
                            {cleanLabel(link.label)}
                        </Button>
                    ),
                )}
            </div>
        </nav>
    );
}
