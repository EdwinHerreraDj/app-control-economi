import { Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';
import { mainNavItems } from '@/components/app-sidebar';
import { EAGER_PREFETCH } from '@/components/nav-main';
import { openQuick } from '@/components/quick/quick-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';

/**
 * Navegación en móvil, ARRIBA: abajo choca con los gestos del sistema
 * (la barra de inicio del iPhone y la navegación por gestos de Android).
 */
export function MobileTabs() {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { url } = usePage();

    // Al llegar a un apartado se precargan los demás (también el de vuelta a
    // Inicio), así cambiar de pestaña es inmediato.
    useEffect(() => {
        mainNavItems.forEach((item) => {
            const href = toUrl(item.href);

            if (
                !url.startsWith(new URL(href, window.location.origin).pathname)
            ) {
                router.prefetch(
                    href,
                    { method: 'get' },
                    { cacheFor: EAGER_PREFETCH.cacheFor },
                );
            }
        });
    }, [url]);

    // El código de los apartados principales se descarga en un momento libre,
    // para que la primera visita a cada uno no espere a descargarlo.
    useEffect(() => {
        const load = () => {
            void import('@/pages/dashboard');
            void import('@/pages/flows/index');
            void import('@/pages/payments/index');
            void import('@/pages/months/index');
        };
        const idle =
            window.requestIdleCallback ??
            ((cb: () => void) => window.setTimeout(cb, 1200));
        idle(load);
    }, []);

    return (
        <nav aria-label="Navegación principal" className="border-b md:hidden">
            <ul className="flex [scrollbar-width:none] items-stretch gap-1 overflow-x-auto px-2 py-1.5">
                {mainNavItems.map(({ title, href, icon: Icon }) => {
                    const active = isCurrentOrParentUrl(href);

                    return (
                        <li key={title} className="flex-1">
                            <Link
                                href={href}
                                {...EAGER_PREFETCH}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                                    active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {Icon && (
                                    <Icon
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                )}
                                {title}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/**
 * Botón flotante para apuntar algo. Va en la esquina inferior derecha, por
 * encima de la zona de gestos (respeta el área segura del dispositivo).
 */
export function FloatingAdd() {
    return (
        <button
            type="button"
            onClick={() => openQuick('menu')}
            className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-40 flex size-16 items-center justify-center rounded-full bg-linear-to-br from-hero-from to-hero-to text-white shadow-xl shadow-primary/30 transition-transform focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 md:hidden"
        >
            <Plus className="size-8" aria-hidden="true" />
            <span className="sr-only">Apuntar algo</span>
        </button>
    );
}
