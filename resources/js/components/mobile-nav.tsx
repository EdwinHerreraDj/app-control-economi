import { Link } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Landmark,
    LayoutGrid,
    Minus,
    Shapes,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as accountsIndex } from '@/routes/accounts';
import { index as categoriesIndex } from '@/routes/categories';
import { index as transactionsIndex } from '@/routes/transactions';

type Item = {
    title: string;
    href: ReturnType<typeof dashboard>;
    icon: LucideIcon;
};

const left: Item[] = [
    { title: 'Panel', href: dashboard(), icon: LayoutGrid },
    { title: 'Movimientos', href: transactionsIndex(), icon: ArrowLeftRight },
];

const right: Item[] = [
    { title: 'Cuentas', href: accountsIndex(), icon: Landmark },
    { title: 'Categorías', href: categoriesIndex(), icon: Shapes },
];

/**
 * Navegación inferior en móvil, con acceso rápido para añadir un gasto
 * (el registro más frecuente) en el centro.
 */
export function MobileNav() {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    const renderItem = ({ title, href, icon: Icon }: Item) => {
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
                    <Icon className="size-5" aria-hidden="true" />
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
                {left.map(renderItem)}
                <li className="flex-1">
                    <Link
                        href={transactionsIndex({ query: { new: 'expense' } })}
                        className="mx-auto -mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
                    >
                        <Minus className="size-6" aria-hidden="true" />
                        <span className="sr-only">Añadir gasto</span>
                    </Link>
                </li>
                {right.map(renderItem)}
            </ul>
        </nav>
    );
}
