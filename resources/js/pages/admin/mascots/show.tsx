import { Form, Head, Link } from '@inertiajs/react';
import {
    Archive,
    ArrowLeft,
    CircleCheck,
    Film,
    Send,
    Star,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import MascotController from '@/actions/App/Http/Controllers/Admin/MascotController';
import { FileUpload } from '@/components/admin/file-upload';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { quickAction } from '@/lib/actions';
import { index as mascotsIndex } from '@/routes/admin/mascots';

type Slot = {
    state: string;
    label: string;
    description: string;
    required: boolean;
    static: {
        url: string;
        width: number | null;
        height: number | null;
        size: number;
    } | null;
    animated: { url: string; duration_ms: number | null; size: number } | null;
};

type Props = {
    mascot: {
        id: number;
        name: string;
        description: string | null;
        status: 'draft' | 'published' | 'archived';
        status_label: string;
        is_default: boolean;
        missing_required: string[];
        missing_optional: string[];
    };
    slots: Slot[];
    previewMessages: Record<string, string[]>;
    limits: {
        static: { max_kb: number; width: number; height: number };
        animated: {
            max_kb: number;
            width: number;
            height: number;
            max_duration_ms: number;
        };
    };
};

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export default function MascotShow({
    mascot,
    slots,
    previewMessages,
    limits,
}: Props) {
    return (
        <>
            <Head title={`Mascota · ${mascot.name}`} />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <Link
                    href={mascotsIndex()}
                    className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Volver al catálogo
                </Link>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <Heading
                            title={mascot.name}
                            description={mascot.description ?? undefined}
                        />
                        <div className="flex flex-wrap gap-1">
                            <Badge
                                variant={
                                    mascot.status === 'published'
                                        ? 'secondary'
                                        : 'outline'
                                }
                            >
                                {mascot.status_label}
                            </Badge>
                            {mascot.is_default && (
                                <Badge variant="outline">
                                    <Star aria-hidden="true" />
                                    Predeterminada
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {mascot.status !== 'published' && (
                            <Button
                                onClick={() =>
                                    quickAction(
                                        MascotController.publish.url(mascot.id),
                                    )
                                }
                            >
                                <Send aria-hidden="true" />
                                Publicar
                            </Button>
                        )}
                        {mascot.status === 'published' &&
                            !mascot.is_default && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            quickAction(
                                                MascotController.makeDefault.url(
                                                    mascot.id,
                                                ),
                                            )
                                        }
                                    >
                                        <Star aria-hidden="true" />
                                        Usar para todos
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            quickAction(
                                                MascotController.archive.url(
                                                    mascot.id,
                                                ),
                                            )
                                        }
                                    >
                                        <Archive aria-hidden="true" />
                                        Archivar
                                    </Button>
                                </>
                            )}
                    </div>
                </div>

                {mascot.missing_required.length > 0 && (
                    <p className="flex gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
                        <TriangleAlert
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        Para publicarla faltan:{' '}
                        {mascot.missing_required.join(', ')}.
                    </p>
                )}
                {mascot.is_default && (
                    <p className="text-sm text-muted-foreground">
                        Es la mascota que ven todas las personas en su panel. Su
                        nombre y sus imágenes se aplican a todas ellas.
                    </p>
                )}
                {mascot.status === 'archived' && (
                    <p className="text-sm text-muted-foreground">
                        Archivada: fuera del catálogo. Puedes volver a
                        publicarla cuando quieras.
                    </p>
                )}

                <section className="max-w-2xl rounded-2xl border bg-card p-5 shadow-xs">
                    <Form
                        {...MascotController.update.form(mascot.id)}
                        options={{ preserveScroll: true }}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nombre</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        defaultValue={mascot.name}
                                        maxLength={60}
                                        required
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">
                                        Descripción
                                    </Label>
                                    <Input
                                        id="description"
                                        name="description"
                                        defaultValue={mascot.description ?? ''}
                                        maxLength={500}
                                    />
                                    <InputError message={errors.description} />
                                </div>
                                <div>
                                    <Button disabled={processing}>
                                        Guardar datos
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </section>

                <section className="space-y-2">
                    <h2 className="font-semibold">Imágenes por estado</h2>
                    <p className="text-sm text-muted-foreground">
                        Estática: PNG o WebP transparente de{' '}
                        {limits.static.width} × {limits.static.height} px, hasta{' '}
                        {limits.static.max_kb} KB. Animada (opcional): WebP
                        animado de {limits.animated.width} ×{' '}
                        {limits.animated.height} px, hasta{' '}
                        {limits.animated.max_kb / 1024} MB y{' '}
                        {limits.animated.max_duration_ms / 1000} s por ciclo.
                        Mantén el mismo encuadre y posición en todos los estados
                        para que no haya saltos.
                    </p>
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {slots.map((slot) => (
                            <li
                                key={slot.state}
                                className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-medium">
                                            {slot.label}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            {slot.description}
                                        </p>
                                    </div>
                                    {slot.static ? (
                                        <CircleCheck
                                            className="size-4 shrink-0 text-primary"
                                            aria-label="Con imagen"
                                        />
                                    ) : slot.required ? (
                                        <Badge variant="outline">
                                            Obligatoria
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">
                                            Usa reposo
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center justify-center gap-3 rounded-xl bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-size-[16px_16px] p-2">
                                    {slot.static ? (
                                        <img
                                            src={slot.static.url}
                                            alt={`${mascot.name}: ${slot.label}`}
                                            className="size-28"
                                        />
                                    ) : (
                                        <span className="flex size-28 items-center justify-center text-xs text-muted-foreground">
                                            Sin imagen
                                        </span>
                                    )}
                                    {slot.animated && (
                                        <img
                                            src={slot.animated.url}
                                            alt=""
                                            className="size-28"
                                        />
                                    )}
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    {slot.static
                                        ? `Estática: ${slot.static.width} × ${slot.static.height} px, ${kb(slot.static.size)}.`
                                        : 'Sin imagen estática.'}{' '}
                                    {slot.animated
                                        ? `Animada: ${((slot.animated.duration_ms ?? 0) / 1000).toFixed(1)} s, ${kb(slot.animated.size)}.`
                                        : slot.static
                                          ? 'Sin animación.'
                                          : ''}
                                </p>

                                {previewMessages[slot.state]?.length > 0 && (
                                    <p className="rounded-xl rounded-bl-sm bg-muted px-3 py-2 text-xs">
                                        {previewMessages[slot.state][0]}
                                    </p>
                                )}

                                <div className="mt-auto flex flex-wrap items-start gap-2">
                                    <FileUpload
                                        url={MascotController.uploadAsset.url({
                                            mascot: mascot.id,
                                            state: slot.state,
                                        })}
                                        accept="image/png,image/webp"
                                        label={
                                            slot.static
                                                ? 'Cambiar imagen'
                                                : 'Subir imagen'
                                        }
                                        data={{ variant: 'static' }}
                                    />
                                    {slot.static && (
                                        <FileUpload
                                            url={MascotController.uploadAsset.url(
                                                {
                                                    mascot: mascot.id,
                                                    state: slot.state,
                                                },
                                            )}
                                            accept="image/webp"
                                            label={
                                                slot.animated
                                                    ? 'Cambiar animación'
                                                    : 'Añadir animación'
                                            }
                                            data={{ variant: 'animated' }}
                                            variant="secondary"
                                        />
                                    )}
                                    {slot.animated && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                quickAction(
                                                    MascotController.removeAsset.url(
                                                        {
                                                            mascot: mascot.id,
                                                            state: slot.state,
                                                        },
                                                        {
                                                            query: {
                                                                variant:
                                                                    'animated',
                                                            },
                                                        },
                                                    ),
                                                    'delete',
                                                )
                                            }
                                        >
                                            <Film aria-hidden="true" />
                                            Quitar animación
                                        </Button>
                                    )}
                                    {slot.static &&
                                        !(
                                            slot.required &&
                                            mascot.status === 'published'
                                        ) && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    quickAction(
                                                        MascotController.removeAsset.url(
                                                            {
                                                                mascot: mascot.id,
                                                                state: slot.state,
                                                            },
                                                        ),
                                                        'delete',
                                                    )
                                                }
                                            >
                                                <Trash2 aria-hidden="true" />
                                                Quitar
                                            </Button>
                                        )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </>
    );
}

MascotShow.layout = {
    breadcrumbs: [{ title: 'Mascotas', href: mascotsIndex() }],
};
