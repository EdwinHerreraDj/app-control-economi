import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';

/**
 * Logotipo de la barra lateral. Usa el que haya subido el superusuario
 * (horizontal, con su variante oscura, o cuadrado) y, si no, el provisional.
 */
export default function AppLogo() {
    const { brand } = usePage().props;

    if (brand.logo) {
        return (
            <span className="flex h-8 items-center">
                <img
                    src={brand.logo}
                    alt={brand.name}
                    className={
                        brand.logo_dark
                            ? 'h-8 w-auto max-w-44 object-contain dark:hidden'
                            : 'h-8 w-auto max-w-44 object-contain'
                    }
                />
                {brand.logo_dark && (
                    <img
                        src={brand.logo_dark}
                        alt={brand.name}
                        className="hidden h-8 w-auto max-w-44 object-contain dark:block"
                    />
                )}
            </span>
        );
    }

    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                {brand.logo_square ? (
                    <img
                        src={brand.logo_square}
                        alt=""
                        className="size-8 object-contain"
                    />
                ) : (
                    <AppLogoIcon className="size-5 fill-current" />
                )}
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-tight font-semibold">
                    {brand.name}
                </span>
            </div>
        </>
    );
}
