import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { FloatingAdd, MobileTabs } from '@/components/mobile-nav';
import { SyncProvider } from '@/components/offline/sync-provider';
import { QuickAddHost } from '@/components/quick/quick-add';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <a
                href="#contenido"
                className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
                Saltar al contenido
            </a>
            <AppSidebar />
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip">
                {/* En móvil, cabecera y apartados quedan fijos arriba, bajo la
                    zona segura de la pantalla (muesca, barra de estado). */}
                <div className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur md:static md:bg-transparent md:pt-0 md:backdrop-blur-none">
                    <AppSidebarHeader breadcrumbs={breadcrumbs} />
                    <MobileTabs />
                </div>
                <div
                    id="contenido"
                    tabIndex={-1}
                    className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+6rem)] outline-none md:pb-0"
                >
                    {children}
                </div>
            </AppContent>
            <FloatingAdd />
            <SyncProvider />
            <QuickAddHost />
        </AppShell>
    );
}
