import type { FormatPreferences } from '@/lib/format';
import type { Auth } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            preferences: FormatPreferences;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
