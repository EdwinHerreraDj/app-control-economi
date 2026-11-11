import { Form, Head, Link } from '@inertiajs/react';
import { Pencil, Plus, Star, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import MascotController from '@/actions/App/Http/Controllers/Admin/MascotController';
import MascotMessageController from '@/actions/App/Http/Controllers/Admin/MascotMessageController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { quickAction } from '@/lib/actions';
import { index as mascotsIndex } from '@/routes/admin/mascots';

type MascotRow = {
    id: number;
    name: string;
    description: string | null;
    status: 'draft' | 'published' | 'archived';
    status_label: string;
    is_default: boolean;
    cover: string | null;
    missing_required: string[];
    missing_optional: string[];
};

type Message = { id: number; state: string; template: string; active: boolean };
type State = { value: string; label: string; description: string };

type Props = {
    mascots: MascotRow[];
    messages: Message[];
    states: State[];
    variables: { key: string; description: string }[];
};

export default function MascotsIndex({
    mascots,
    messages,
    states,
    variables,
}: Props) {
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<Message | 'new' | null>(null);

    return (
        <>
            <Head title="Mascotas" />

            <div className="flex flex-col gap-8 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Mascotas"
                        description="La mascota predeterminada es la que ven todas las personas en su panel. Se puede publicar solo con imágenes estáticas y añadir animaciones después."
                    />
                    <Button onClick={() => setCreating(true)}>
                        <Plus aria-hidden="true" />
                        Nueva mascota
                    </Button>
                </div>

                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {mascots.map((mascot) => (
                        <li
                            key={mascot.id}
                            className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
                        >
                            <div className="flex items-start gap-3">
                                {mascot.cover ? (
                                    <img
                                        src={mascot.cover}
                                        alt=""
                                        className="size-20 shrink-0"
                                    />
                                ) : (
                                    <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-dashed text-[10px] text-muted-foreground">
                                        Sin imagen
                                    </div>
                                )}
                                <div className="min-w-0 flex-1 space-y-1">
                                    <h2 className="font-semibold">
                                        {mascot.name}
                                    </h2>
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
                                    {mascot.is_default && (
                                        <p className="text-xs text-muted-foreground">
                                            La ven todas las personas.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {mascot.missing_required.length > 0 && (
                                <p className="flex gap-2 text-xs">
                                    <TriangleAlert
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    Faltan imágenes obligatorias:{' '}
                                    {mascot.missing_required.join(', ')}.
                                </p>
                            )}
                            {mascot.missing_optional.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Usan la imagen de reposo:{' '}
                                    {mascot.missing_optional.join(', ')}.
                                </p>
                            )}

                            <div className="mt-auto flex flex-wrap gap-2">
                                <Button size="sm" asChild>
                                    <Link
                                        href={MascotController.show.url(
                                            mascot.id,
                                        )}
                                    >
                                        <Pencil aria-hidden="true" />
                                        Gestionar
                                    </Link>
                                </Button>
                                {mascot.status === 'published' &&
                                    !mascot.is_default && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                quickAction(
                                                    MascotController.makeDefault.url(
                                                        mascot.id,
                                                    ),
                                                )
                                            }
                                        >
                                            Usar para todos
                                        </Button>
                                    )}
                            </div>
                        </li>
                    ))}
                </ul>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="font-semibold">
                                Mensajes por situación
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Comunes a todas las mascotas. Se elige uno al
                                día por situación. Deben ser prudentes: hablan
                                de previsiones, no de certezas, y nunca culpan
                                ni presionan.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setEditing('new')}
                        >
                            <Plus aria-hidden="true" />
                            Añadir mensaje
                        </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {states.map((state) => (
                            <section
                                key={state.value}
                                className="rounded-2xl border bg-card p-4 shadow-xs"
                            >
                                <h3 className="font-medium">{state.label}</h3>
                                <p className="mb-2 text-xs text-muted-foreground">
                                    {state.description}
                                </p>
                                <ul className="space-y-2">
                                    {messages
                                        .filter((m) => m.state === state.value)
                                        .map((message) => (
                                            <li
                                                key={message.id}
                                                className="flex items-start gap-2 rounded-lg bg-muted/50 p-2 text-sm"
                                            >
                                                <span
                                                    className={
                                                        message.active
                                                            ? 'flex-1'
                                                            : 'flex-1 text-muted-foreground line-through'
                                                    }
                                                >
                                                    {message.template}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    aria-label="Editar mensaje"
                                                    onClick={() =>
                                                        setEditing(message)
                                                    }
                                                >
                                                    <Pencil aria-hidden="true" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    aria-label="Eliminar mensaje"
                                                    onClick={() =>
                                                        quickAction(
                                                            MascotMessageController.destroy.url(
                                                                message.id,
                                                            ),
                                                            'delete',
                                                        )
                                                    }
                                                >
                                                    <Trash2 aria-hidden="true" />
                                                </Button>
                                            </li>
                                        ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </section>
            </div>

            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent>
                    <Form
                        {...MascotController.store.form()}
                        className="space-y-5"
                    >
                        {({ errors, processing }) => (
                            <>
                                <DialogTitle>Nueva mascota</DialogTitle>
                                <DialogDescription>
                                    Se crea como borrador. Después subes sus
                                    imágenes y la publicas.
                                </DialogDescription>
                                <div className="grid gap-2">
                                    <Label htmlFor="mascot-name">Nombre</Label>
                                    <Input
                                        id="mascot-name"
                                        name="name"
                                        required
                                        maxLength={60}
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="mascot-description">
                                        Descripción
                                    </Label>
                                    <Input
                                        id="mascot-description"
                                        name="description"
                                        maxLength={500}
                                    />
                                    <InputError message={errors.description} />
                                </div>
                                <DialogFooter className="gap-2">
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                        >
                                            Cancelar
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        Crear borrador
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent>
                    {editing !== null && (
                        <Form
                            {...(editing === 'new'
                                ? MascotMessageController.store.form()
                                : MascotMessageController.update.form(
                                      editing.id,
                                  ))}
                            options={{ preserveScroll: true }}
                            onSuccess={() => setEditing(null)}
                            className="space-y-5"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <DialogTitle>
                                        {editing === 'new'
                                            ? 'Nuevo mensaje'
                                            : 'Editar mensaje'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Puedes usar estas variables entre
                                        llaves; cualquier otra se rechaza.
                                    </DialogDescription>
                                    <ul className="grid gap-1 text-xs">
                                        {variables.map((v) => (
                                            <li key={v.key}>
                                                <code className="rounded bg-muted px-1">{`{${v.key}}`}</code>{' '}
                                                {v.description}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="grid gap-2">
                                        <Label htmlFor="message-state">
                                            Situación
                                        </Label>
                                        <NativeSelect
                                            id="message-state"
                                            name="state"
                                            defaultValue={
                                                editing === 'new'
                                                    ? states[0].value
                                                    : editing.state
                                            }
                                        >
                                            {states.map((s) => (
                                                <option
                                                    key={s.value}
                                                    value={s.value}
                                                >
                                                    {s.label}
                                                </option>
                                            ))}
                                        </NativeSelect>
                                        <InputError message={errors.state} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="message-template">
                                            Mensaje
                                        </Label>
                                        <textarea
                                            id="message-template"
                                            name="template"
                                            defaultValue={
                                                editing === 'new'
                                                    ? ''
                                                    : editing.template
                                            }
                                            maxLength={280}
                                            rows={3}
                                            required
                                            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                                        />
                                        <InputError message={errors.template} />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="hidden"
                                            name="active"
                                            value="0"
                                        />
                                        <input
                                            type="checkbox"
                                            name="active"
                                            value="1"
                                            defaultChecked={
                                                editing === 'new'
                                                    ? true
                                                    : editing.active
                                            }
                                            className="accent-primary"
                                        />
                                        Activo
                                    </label>
                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                            >
                                                Cancelar
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Guardar
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

MascotsIndex.layout = {
    breadcrumbs: [{ title: 'Mascotas', href: mascotsIndex() }],
};
