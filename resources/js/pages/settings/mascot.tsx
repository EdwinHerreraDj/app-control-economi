import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import MascotController from '@/actions/App/Http/Controllers/Settings/MascotController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { edit } from '@/routes/mascot';
import type { MascotImages } from '@/types/branding';

type Props = {
    mascot: {
        name: string;
        description: string | null;
        images: MascotImages;
    } | null;
    settings: {
        mascot_visibility: 'shown' | 'minimized' | 'hidden';
        mascot_motion: 'full' | 'reduced' | 'none';
    };
};

const PREVIEW = [
    ['idle', 'Reposo'],
    ['welcome', 'Saludo'],
    ['celebration', 'Celebración'],
    ['attention', 'Atención'],
    ['support', 'Acompaña'],
    ['unknown', 'Sin datos'],
] as const;

function Choice<T extends string>({
    name,
    value,
    options,
    onChange,
}: {
    name: string;
    value: T;
    options: [T, string, string][];
    onChange: (value: T) => void;
}) {
    return (
        <div className="grid gap-2 sm:grid-cols-3">
            {options.map(([option, label, hint]) => (
                <label
                    key={option}
                    className="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
                >
                    <span className="flex items-center gap-2 font-medium">
                        <input
                            type="radio"
                            name={name}
                            value={option}
                            checked={value === option}
                            onChange={() => onChange(option)}
                            className="accent-primary"
                        />
                        {label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {hint}
                    </span>
                </label>
            ))}
        </div>
    );
}

export default function MascotSettings({ mascot, settings }: Props) {
    const [visibility, setVisibility] = useState(settings.mascot_visibility);
    const [motion, setMotion] = useState(settings.mascot_motion);

    return (
        <>
            <Head title="Mascota" />
            <h1 className="sr-only">Mascota</h1>

            {mascot && (
                <section className="space-y-4">
                    <Heading
                        variant="small"
                        title={`Tu acompañante: ${mascot.name}`}
                        description={`${mascot.description ?? ''} Nunca enferma ni se pone triste por tus finanzas: está para ayudarte.`}
                    />
                    <ul className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/50 p-3 sm:grid-cols-6">
                        {PREVIEW.map(([state, label]) => (
                            <li key={state} className="text-center">
                                {mascot.images[state].static && (
                                    <img
                                        src={mascot.images[state].static}
                                        alt=""
                                        className="mx-auto size-16"
                                    />
                                )}
                                <span className="text-[11px] text-muted-foreground">
                                    {label}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                        La mascota, su nombre y sus mensajes los gestiona el
                        administrador.
                    </p>
                </section>
            )}

            <Form
                {...MascotController.update.form()}
                options={{ preserveScroll: true }}
                className="space-y-8"
            >
                {({ processing }) => (
                    <>
                        <section className="space-y-2">
                            <h2 className="text-sm font-medium">En el panel</h2>
                            <Choice
                                name="mascot_visibility"
                                value={visibility}
                                onChange={setVisibility}
                                options={[
                                    ['shown', 'Visible', 'Junto a tu resumen'],
                                    [
                                        'minimized',
                                        'Minimizada',
                                        'Un botón pequeño en una esquina',
                                    ],
                                    ['hidden', 'Oculta', 'No aparece'],
                                ]}
                            />
                        </section>

                        <section className="space-y-2">
                            <h2 className="text-sm font-medium">Animaciones</h2>
                            <Choice
                                name="mascot_motion"
                                value={motion}
                                onChange={setMotion}
                                options={[
                                    ['full', 'Completas', 'Movimientos suaves'],
                                    [
                                        'reduced',
                                        'Reducidas',
                                        'Solo un gesto breve al saludar o celebrar',
                                    ],
                                    ['none', 'Ninguna', 'Imagen fija'],
                                ]}
                            />
                            <p className="text-xs text-muted-foreground">
                                Si tu dispositivo tiene activado «reducir
                                movimiento», se respeta siempre.
                            </p>
                        </section>

                        <Button
                            disabled={processing}
                            data-test="update-mascot-button"
                        >
                            Guardar
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

MascotSettings.layout = {
    breadcrumbs: [{ title: 'Mascota', href: edit() }],
};
