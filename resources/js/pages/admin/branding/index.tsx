import { Form, Head } from '@inertiajs/react';
import { RotateCcw } from 'lucide-react';
import BrandingController from '@/actions/App/Http/Controllers/Admin/BrandingController';
import { FileUpload } from '@/components/admin/file-upload';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { quickAction } from '@/lib/actions';
import { edit as brandingEdit } from '@/routes/admin/branding';

type Asset = {
    key: string;
    label: string;
    help: string;
    accept: string;
    max_kb: number;
    preview: 'square' | 'logo' | 'logo-dark' | 'favicon' | 'app' | 'maskable';
    url: string | null;
    custom: boolean;
};

type Props = {
    settings: {
        name: string;
        short_name: string;
        theme_color: string;
        background_color: string;
        primary_color: string | null;
    };
    assets: Asset[];
};

function Preview({ asset }: { asset: Asset }) {
    if (!asset.url) {
        return (
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                Sin archivo
            </div>
        );
    }

    switch (asset.preview) {
        case 'logo':
        case 'logo-dark':
            return (
                <div
                    className={
                        asset.preview === 'logo'
                            ? 'flex h-20 items-center justify-center rounded-lg border bg-white p-3'
                            : 'flex h-20 items-center justify-center rounded-lg border bg-[#0f1a1d] p-3'
                    }
                >
                    <img
                        src={asset.url}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            );
        case 'favicon':
            return (
                <div className="flex h-20 items-end justify-center gap-4 rounded-lg border bg-muted/40 p-3">
                    {[16, 32, 48].map((size) => (
                        <figure key={size} className="text-center">
                            <img
                                src={asset.url!}
                                alt=""
                                width={size}
                                height={size}
                                className="mx-auto"
                            />
                            <figcaption className="text-[10px] text-muted-foreground">
                                {size} px
                            </figcaption>
                        </figure>
                    ))}
                </div>
            );
        case 'maskable':
            return (
                <div className="flex h-20 items-center justify-center gap-4 rounded-lg border bg-muted/40 p-2">
                    <img
                        src={asset.url}
                        alt=""
                        className="size-16 rounded-md"
                    />
                    {/* Recorte circular como el de Android: lo esencial debe verse entero. */}
                    <img
                        src={asset.url}
                        alt=""
                        className="size-16 rounded-full"
                    />
                    <span className="max-w-24 text-[10px] text-muted-foreground">
                        Así lo puede recortar el sistema
                    </span>
                </div>
            );
        case 'app':
            return (
                <div className="flex h-20 items-center justify-center rounded-lg border bg-muted/40 p-2">
                    <img
                        src={asset.url}
                        alt=""
                        className="size-16 rounded-2xl shadow-sm"
                    />
                </div>
            );
        default:
            return (
                <div className="flex h-20 items-center justify-center rounded-lg border bg-muted/40 p-2">
                    <img
                        src={asset.url}
                        alt=""
                        className="size-16 object-contain"
                    />
                </div>
            );
    }
}

export default function BrandingIndex({ settings, assets }: Props) {
    const source = assets.find((asset) => asset.key === 'source');
    const others = assets.filter((asset) => asset.key !== 'source');

    return (
        <>
            <Head title="Identidad visual" />

            <div className="flex flex-col gap-8 p-4 md:p-6">
                <Heading
                    title="Identidad visual"
                    description="Nombre, colores, logotipos e iconos de la aplicación. Los cambios se aplican a todas las personas."
                />

                <section className="max-w-2xl space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
                    <h2 className="font-semibold">Nombre y colores</h2>
                    <Form
                        {...BrandingController.update.form()}
                        options={{ preserveScroll: true }}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="brand-name">Nombre</Label>
                                    <Input
                                        id="brand-name"
                                        name="name"
                                        defaultValue={settings.name}
                                        maxLength={60}
                                        required
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="brand-short">
                                        Nombre corto
                                    </Label>
                                    <Input
                                        id="brand-short"
                                        name="short_name"
                                        defaultValue={settings.short_name}
                                        maxLength={15}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Bajo el icono de la app instalada (máx.
                                        15 caracteres).
                                    </p>
                                    <InputError message={errors.short_name} />
                                </div>
                                {(
                                    [
                                        [
                                            'theme_color',
                                            'Color de la barra del navegador',
                                            settings.theme_color,
                                            'También colorea la barra de la app instalada.',
                                        ],
                                        [
                                            'background_color',
                                            'Color de fondo al abrir la app',
                                            settings.background_color,
                                            'Pantalla de carga de la app instalada.',
                                        ],
                                        [
                                            'primary_color',
                                            'Color principal (opcional)',
                                            settings.primary_color ?? '#4f3ff0',
                                            'Botones y enlaces en el tema claro. Debe contrastar con texto blanco (4,5:1).',
                                        ],
                                    ] as const
                                ).map(([field, label, value, hint]) => (
                                    <div key={field} className="grid gap-2">
                                        <Label htmlFor={`brand-${field}`}>
                                            {label}
                                        </Label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                aria-label={`${label}: selector`}
                                                defaultValue={value}
                                                onChange={(e) => {
                                                    const text =
                                                        document.getElementById(
                                                            `brand-${field}`,
                                                        ) as HTMLInputElement | null;
                                                    if (text)
                                                        text.value =
                                                            e.target.value;
                                                }}
                                                className="h-10 w-12 cursor-pointer rounded-md border bg-transparent"
                                            />
                                            <Input
                                                id={`brand-${field}`}
                                                name={field}
                                                defaultValue={
                                                    field === 'primary_color'
                                                        ? (settings.primary_color ??
                                                          '')
                                                        : value
                                                }
                                                placeholder={
                                                    field === 'primary_color'
                                                        ? 'Sin cambiar'
                                                        : undefined
                                                }
                                                pattern="#[0-9a-fA-F]{6}"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {hint}
                                        </p>
                                        <InputError message={errors[field]} />
                                    </div>
                                ))}
                                <div className="sm:col-span-2">
                                    <Button disabled={processing}>
                                        Guardar
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </section>

                {source && (
                    <section className="max-w-2xl space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
                        <h2 className="font-semibold">
                            Empieza por un original
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {source.help}
                        </p>
                        <div className="flex flex-wrap items-start gap-4">
                            <div className="w-40">
                                <Preview asset={source} />
                            </div>
                            <FileUpload
                                url={BrandingController.upload.url('source')}
                                accept={source.accept}
                                label="Subir original y generar iconos"
                                variant="default"
                            />
                        </div>
                    </section>
                )}

                <section className="space-y-3">
                    <h2 className="font-semibold">Recursos</h2>
                    <p className="text-sm text-muted-foreground">
                        Puedes sustituir cada uno por separado. Los iconos de
                        una app ya instalada pueden tardar en actualizarse:
                        depende del sistema.
                    </p>
                    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {others.map((asset) => (
                            <li
                                key={asset.key}
                                className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-medium">
                                        {asset.label}
                                    </h3>
                                    <Badge
                                        variant={
                                            asset.custom
                                                ? 'secondary'
                                                : 'outline'
                                        }
                                    >
                                        {asset.custom
                                            ? 'Personalizado'
                                            : 'Por defecto'}
                                    </Badge>
                                </div>
                                <Preview asset={asset} />
                                <p className="text-xs text-muted-foreground">
                                    {asset.help} Máximo{' '}
                                    {asset.max_kb >= 1024
                                        ? `${asset.max_kb / 1024} MB`
                                        : `${asset.max_kb} KB`}
                                    .
                                </p>
                                <div className="mt-auto flex flex-wrap items-start gap-2">
                                    <FileUpload
                                        url={BrandingController.upload.url(
                                            asset.key,
                                        )}
                                        accept={asset.accept}
                                        label="Subir"
                                    />
                                    {asset.custom && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                quickAction(
                                                    BrandingController.reset.url(
                                                        asset.key,
                                                    ),
                                                    'delete',
                                                )
                                            }
                                        >
                                            <RotateCcw aria-hidden="true" />
                                            Usar el de por defecto
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

BrandingIndex.layout = {
    breadcrumbs: [{ title: 'Identidad visual', href: brandingEdit() }],
};
