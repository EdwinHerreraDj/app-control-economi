import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

/** Precarga de los apartados principales: cambiar de pestaña es instantáneo. */
export const EAGER_PREFETCH = {
    prefetch: ['mount', 'hover'] as ('mount' | 'hover')[],
    cacheFor: ['30s', '5m'],
};

export function NavMain({
    items,
    label,
    eager = false,
}: {
    items: NavItem[];
    label: string;
    eager?: boolean;
}) {
    // Marca también las subpáginas (p. ej. una ficha dentro de una sección).
    const { isCurrentOrParentUrl } = useCurrentUrl();
    // En móvil el menú lateral se cierra al elegir una opción.
    const { isMobile, setOpenMobile } = useSidebar();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={isCurrentOrParentUrl(item.href)}
                            tooltip={{ children: item.title }}
                            className="h-10 text-base [&>svg]:size-5"
                        >
                            <Link
                                href={item.href}
                                {...(eager
                                    ? EAGER_PREFETCH
                                    : { prefetch: true })}
                                onClick={() => isMobile && setOpenMobile(false)}
                            >
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
