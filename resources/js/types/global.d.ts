import type { FormatPreferences } from '@/lib/format';
import type { Auth } from '@/types/auth';
import type { Brand } from '@/types/branding';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            brand: Brand;
            auth: Auth;
            preferences: FormatPreferences;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
