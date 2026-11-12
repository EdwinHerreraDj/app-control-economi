import { Head } from '@inertiajs/react';
import { ArrowLeft, House, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
    status: number;
    title: string;
    message: string;
    retry: boolean;
    brand: { name: string; logo: string | null };
    mascot: { name: string | null; image: string } | null;
};

/**
 * Página de error de la app (404, 403, 429, 500…). Es autónoma: no depende
 * de la sesión ni del menú, porque puede mostrarse en rutas que no existen.
 */
export default function ErrorPage({
    status,
    title,
    message,
    retry,
    brand,
    mascot,
}: Props) {
    const canGoBack =
        typeof window !== 'undefined' && window.history.length > 1;

    return (
        <div className="flex min-h-svh flex-col bg-background">
            <Head title={title} />

            <header className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6">
                {brand.logo && (
                    <img
                        src={brand.logo}
                        alt=""
                        className="size-8 rounded-lg"
                        width={32}
                        height={32}
                    />
                )}
                <span className="text-sm font-semibold">{brand.name}</span>
            </header>

            <main className="flex flex-1 items-center justify-center px-4 pb-16">
                <div className="w-full max-w-md text-center">
                    {mascot ? (
                        <img
                            src={mascot.image}
                            alt=""
                            className="mx-auto mb-4 size-36"
                            width={144}
                            height={144}
                        />
                    ) : (
                        <p
                            className="mb-4 text-7xl font-semibold text-primary/30 tabular-nums"
                            aria-hidden="true"
                        >
                            {status}
                        </p>
                    )}

                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Error {status}
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-balance">
                        {title}
                    </h1>
                    <p className="mt-3 text-pretty text-muted-foreground">
                        {message}
                    </p>

                    <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
                        {retry ? (
                            <Button onClick={() => window.location.reload()}>
                                <RotateCw aria-hidden="true" />
                                Volver a intentarlo
                            </Button>
                        ) : (
                            <Button asChild>
                                <a href="/dashboard">
                                    <House aria-hidden="true" />
                                    Ir al inicio
                                </a>
                            </Button>
                        )}
                        {retry && (
                            <Button variant="outline" asChild>
                                <a href="/dashboard">
                                    <House aria-hidden="true" />
                                    Ir al inicio
                                </a>
                            </Button>
                        )}
                        {canGoBack && (
                            <Button
                                variant="ghost"
                                onClick={() => window.history.back()}
                            >
                                <ArrowLeft aria-hidden="true" />
                                Volver atrás
                            </Button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
