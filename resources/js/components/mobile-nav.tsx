import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { mainNavItems } from '@/components/app-sidebar';
import { openQuick } from '@/components/quick/quick-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

/**
 * Navegación inferior en móvil: los cuatro apartados y, en el centro, el
 * botón para apuntar algo (lo que más se hace).
 */
export function MobileNav() {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const [first, second, third, fourth] = mainNavItems;

    const renderItem = ({ title, href, icon: Icon }: NavItem) => {
        const active = isCurrentOrParentUrl(href);

        return (
            <li key={title} className="flex-1">
                <Link
                    href={href}
                    prefetch
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                        'flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium',
                        active ? 'text-primary' : 'text-muted-foreground',
                    )}
                >
                    {Icon && <Icon className="size-5" aria-hidden="true" />}
                    {title}
                </Link>
            </li>
        );
    };

    return (
        <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
            <ul className="mx-auto flex max-w-md items-center px-2">
                {[first, second].map(renderItem)}
                <li className="flex-1">
                    <button
                        type="button"
                        onClick={() => openQuick('menu')}
                        className="mx-auto -mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <Plus className="size-7" aria-hidden="true" />
                        <span className="sr-only">Apuntar algo</span>
                    </button>
                </li>
                {[third, fourth].map(renderItem)}
            </ul>
        </nav>
    );
}
