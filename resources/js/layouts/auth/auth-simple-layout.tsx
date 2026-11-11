import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name, brand } = usePage().props;

    return (
        <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
            <div className="w-full max-w-md">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-2 rounded-lg font-medium"
                        >
                            {brand.logo ? (
                                <>
                                    <img
                                        src={brand.logo}
                                        alt={name}
                                        className={
                                            brand.logo_dark
                                                ? 'h-12 w-auto max-w-60 object-contain dark:hidden'
                                                : 'h-12 w-auto max-w-60 object-contain'
                                        }
                                    />
                                    {brand.logo_dark && (
                                        <img
                                            src={brand.logo_dark}
                                            alt={name}
                                            className="hidden h-12 w-auto max-w-60 object-contain dark:block"
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm">
                                        {brand.logo_square ? (
                                            <img
                                                src={brand.logo_square}
                                                alt=""
                                                className="size-12 object-contain"
                                            />
                                        ) : (
                                            <AppLogoIcon className="size-7 fill-current" />
                                        )}
                                    </span>
                                    <span className="text-sm font-semibold">
                                        {name}
                                    </span>
                                </>
                            )}
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-semibold">{title}</h1>
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
                        {children}
                    </div>
                </div>
            </div>
        </main>
    );
}
