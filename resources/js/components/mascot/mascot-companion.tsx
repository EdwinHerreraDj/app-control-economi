import { Link, router } from '@inertiajs/react';
import { EyeOff, Minimize2, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MascotController from '@/actions/App/Http/Controllers/Settings/MascotController';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSyncState } from '@/offline/sync';
import { edit as editMascot } from '@/routes/mascot';
import type { MascotCompanionData, MascotStateName } from '@/types/branding';

/** Duración del gesto pasajero (saludo o celebración) antes de volver al estado. */
const TRANSIENT_MS = 4500;

const ANIMATION: Partial<Record<MascotStateName, string>> = {
    idle: 'mascot-breathe',
    unknown: 'mascot-breathe',
    support: 'mascot-breathe',
    attention: 'mascot-tilt',
    welcome: 'mascot-wave',
    celebration: 'mascot-hop',
};

function setVisibility(visibility: MascotCompanionData['visibility']) {
    router.patch(
        MascotController.visibility.url(),
        { mascot_visibility: visibility },
        { preserveScroll: true, preserveState: true },
    );
}

/**
 * Mascota del panel. Nunca sustituye al resumen real de las cuentas: es un
 * acompañamiento opcional que se puede minimizar u ocultar.
 */
export function MascotCompanion({ mascot }: { mascot: MascotCompanionData }) {
    const [showTransient, setShowTransient] = useState(
        mascot.transient !== null,
    );
    const [visible, setVisible] = useState(true);
    const ref = useRef<HTMLDivElement>(null);
    // Sus mensajes avisan si aún faltan movimientos registrados sin conexión.
    const { pending, attention } = useSyncState();
    const unsent = pending + attention;

    useEffect(() => {
        if (!mascot.transient) {
            return;
        }

        const timer = window.setTimeout(
            () => setShowTransient(false),
            TRANSIENT_MS,
        );

        return () => window.clearTimeout(timer);
    }, [mascot.transient]);

    // Pausa las animaciones cuando la mascota no está a la vista.
    useEffect(() => {
        const element = ref.current;

        if (!element || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver(([entry]) =>
            setVisible(entry.isIntersecting),
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const displayed: MascotStateName =
        showTransient && mascot.transient ? mascot.transient : mascot.state;
    const image = mascot.images[displayed];
    const useAnimated = mascot.motion === 'full' && image.animated !== null;
    const src = useAnimated ? image.animated : image.static;

    // «Reducido»: sin bucles, solo el gesto pasajero una vez. «Ninguno»: quieto.
    const animation =
        mascot.motion === 'none' || useAnimated
            ? null
            : mascot.motion === 'reduced' &&
                !(showTransient && mascot.transient)
              ? null
              : ANIMATION[displayed];

    if (mascot.visibility === 'minimized') {
        return (
            <button
                type="button"
                onClick={() => setVisibility('shown')}
                className="fixed right-4 bottom-24 z-30 flex size-14 items-center justify-center overflow-hidden rounded-full border bg-card shadow-lg md:bottom-6"
                aria-label={`Mostrar a ${mascot.name}`}
                title={`Mostrar a ${mascot.name}`}
            >
                {mascot.images.idle.static && (
                    <img
                        src={mascot.images.idle.static}
                        alt=""
                        className="size-12"
                    />
                )}
            </button>
        );
    }

    return (
        <section
            ref={ref}
            aria-label={`${mascot.name}, tu mascota`}
            className="relative flex items-end gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:gap-4"
        >
            <div className="shrink-0">
                {src && (
                    <img
                        key={`${displayed}-${src}`}
                        src={src}
                        alt={`${mascot.name}: ${stateLabel(displayed)}`}
                        width={112}
                        height={112}
                        className={cn(
                            'size-24 select-none sm:size-28',
                            animation,
                        )}
                        style={{
                            animationPlayState: visible ? 'running' : 'paused',
                        }}
                        draggable={false}
                    />
                )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-medium text-muted-foreground">
                    {mascot.name}
                </p>
                {mascot.message ? (
                    <p
                        className="relative mt-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm"
                        aria-live="polite"
                    >
                        {mascot.message}
                    </p>
                ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {mascot.reason}
                    </p>
                )}
                {unsent > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Aún no cuento{' '}
                        {unsent === 1
                            ? '1 movimiento registrado sin conexión'
                            : `${unsent} movimientos registrados sin conexión`}
                        .
                    </p>
                )}
            </div>

            <div className="absolute top-2 right-2 flex gap-1">
                <Button variant="ghost" size="icon" className="size-8" asChild>
                    <Link
                        href={editMascot()}
                        aria-label="Preferencias de la mascota"
                    >
                        <Settings2 aria-hidden="true" />
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Minimizar la mascota"
                    onClick={() => setVisibility('minimized')}
                >
                    <Minimize2 aria-hidden="true" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Ocultar la mascota"
                    onClick={() => setVisibility('hidden')}
                >
                    <EyeOff aria-hidden="true" />
                </Button>
            </div>
        </section>
    );
}

function stateLabel(state: MascotStateName): string {
    return {
        cover: 'presentación',
        idle: 'tranquila',
        welcome: 'saludando',
        celebration: 'celebrando',
        attention: 'atenta',
        support: 'acompañándote',
        unknown: 'esperando datos',
    }[state];
}
