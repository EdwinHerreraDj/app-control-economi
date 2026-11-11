import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { setupPwa } from '@/offline/pwa';

// El nombre lo configura el superusuario; la plantilla lo publica en esta meta.
const appName =
    document
        .querySelector('meta[name="application-name"]')
        ?.getAttribute('content') ||
    import.meta.env.VITE_APP_NAME ||
    'Economía Personal';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            // Página autónoma: funciona sin sesión ni conexión.
            case name === 'offline' || name === 'error':
                return null;
            case name.startsWith('auth/') || name === 'onboarding':
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();

// Service worker, aviso de actualizaciones e instalación de la PWA.
setupPwa();
