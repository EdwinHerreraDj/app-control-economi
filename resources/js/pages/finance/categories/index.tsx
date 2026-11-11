import { Form, Head, router } from '@inertiajs/react';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import CategoryController from '@/actions/App/Http/Controllers/Finance/CategoryController';
import {
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    COLOR_LABELS,
    CategoryIcon,
} from '@/components/finance/category-badge';
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
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { index as categoriesIndex } from '@/routes/categories';

type Kind = 'income' | 'expense';

type Category = {
    id: number;
    kind: Kind;
    name: string;
    icon: string;
    color: string;
    archived: boolean;
    transactions_count: number;
};

type Props = {
    categories: Category[];
    icons: string[];
    colors: string[];
};

const KIND_LABELS: Record<Kind, string> = {
    expense: 'Gastos',
    income: 'Ingresos',
};

function postAction(url: string) {
    router.post(
        url,
        {},
        {
            preserveScroll: true,
            onError: (errors) => {
                const first = Object.values(errors)[0];

                if (first) {
                    toast.error(first);
                }
            },
        },
    );
}

export default function CategoriesIndex({ categories, icons, colors }: Props) {
    const [kind, setKind] = useState<Kind>('expense');
    const [editing, setEditing] = useState<Category | 'new' | null>(null);
    const visible = categories.filter((category) => category.kind === kind);

    return (
        <>
            <Head title="Categorías" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Categorías"
                        description="Agrupa tus movimientos para entender en qué se va y de dónde viene tu dinero."
                    />
                    <Button onClick={() => setEditing('new')}>
                        <Plus aria-hidden="true" />
                        Nueva categoría
                    </Button>
                </div>

                <div
                    role="group"
                    aria-label="Tipo de categoría"
                    className="inline-flex w-fit gap-1 rounded-xl bg-muted p-1"
                >
                    {(['expense', 'income'] as Kind[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={kind === option}
                            onClick={() => setKind(option)}
                            className={cn(
                                'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                                kind === option
                                    ? 'bg-background shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {KIND_LABELS[option]}
                        </button>
                    ))}
                </div>

                {visible.length === 0 ? (
                    <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No tienes categorías de{' '}
                        {KIND_LABELS[kind].toLowerCase()}.
                    </p>
                ) : (
                    <ul className="divide-y rounded-2xl border bg-card shadow-xs">
                        {visible.map((category) => (
                            <li
                                key={category.id}
                                className={cn(
                                    'flex items-center gap-3 p-3 sm:p-4',
                                    category.archived && 'opacity-70',
                                )}
                            >
                                <CategoryIcon
                                    icon={category.icon}
                                    color={category.color}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">
                                        {category.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {category.transactions_count === 1
                                            ? '1 movimiento'
                                            : `${category.transactions_count} movimientos`}
                                    </p>
                                </div>
                                {category.archived && (
                                    <Badge variant="outline">Archivada</Badge>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Editar ${category.name}`}
                                    onClick={() => setEditing(category)}
                                >
                                    <Pencil aria-hidden="true" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                        category.archived
                                            ? `Restaurar ${category.name}`
                                            : `Archivar ${category.name}`
                                    }
                                    onClick={() =>
                                        postAction(
                                            category.archived
                                                ? CategoryController.restore.url(
                                                      category.id,
                                                  )
                                                : CategoryController.archive.url(
                                                      category.id,
                                                  ),
                                        )
                                    }
                                >
                                    {category.archived ? (
                                        <ArchiveRestore aria-hidden="true" />
                                    ) : (
                                        <Archive aria-hidden="true" />
                                    )}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}

                <p className="text-xs text-muted-foreground">
                    Archivar una categoría la oculta para movimientos nuevos,
                    pero conserva tu historial.
                </p>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto">
                    {editing !== null && (
                        <CategoryForm
                            category={editing === 'new' ? null : editing}
                            kind={kind}
                            icons={icons}
                            colors={colors}
                            onDone={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function CategoryForm({
    category,
    kind,
    icons,
    colors,
    onDone,
}: {
    category: Category | null;
    kind: Kind;
    icons: string[];
    colors: string[];
    onDone: () => void;
}) {
    const [icon, setIcon] = useState(category?.icon ?? icons[0]);
    const [color, setColor] = useState(category?.color ?? colors[0]);
    const form = category
        ? CategoryController.update.form(category.id)
        : CategoryController.store.form();

    return (
        <Form
            {...form}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-6"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>
                        {category
                            ? `Editar «${category.name}»`
                            : `Nueva categoría de ${KIND_LABELS[kind].toLowerCase()}`}
                    </DialogTitle>
                    <DialogDescription>
                        Elige un nombre, un icono y un color para reconocerla de
                        un vistazo.
                    </DialogDescription>

                    {!category && (
                        <input type="hidden" name="kind" value={kind} />
                    )}

                    <div className="flex items-center gap-3">
                        <CategoryIcon icon={icon} color={color} />
                        <div className="grid flex-1 gap-2">
                            <Label htmlFor="category-name">Nombre</Label>
                            <Input
                                id="category-name"
                                name="name"
                                defaultValue={category?.name}
                                required
                                maxLength={60}
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <InputError message={errors.name ?? errors.kind} />

                    <fieldset className="grid gap-2">
                        <legend className="mb-2 text-sm font-medium">
                            Icono
                        </legend>
                        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                            {icons.map((option) => {
                                const Icon = CATEGORY_ICONS[option];

                                return (
                                    <label
                                        key={option}
                                        className={cn(
                                            'flex aspect-square cursor-pointer items-center justify-center rounded-lg border has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                            icon === option
                                                ? 'border-primary bg-primary/10'
                                                : 'hover:bg-muted',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="icon"
                                            value={option}
                                            checked={icon === option}
                                            onChange={() => setIcon(option)}
                                            className="sr-only"
                                        />
                                        {Icon && (
                                            <Icon
                                                className="size-4.5"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span className="sr-only">
                                            {option.replaceAll('-', ' ')}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        <InputError message={errors.icon} />
                    </fieldset>

                    <fieldset className="grid gap-2">
                        <legend className="mb-2 text-sm font-medium">
                            Color
                        </legend>
                        <div className="flex flex-wrap gap-2">
                            {colors.map((option) => (
                                <label
                                    key={option}
                                    title={COLOR_LABELS[option]}
                                    className={cn(
                                        'flex size-9 cursor-pointer items-center justify-center rounded-full border-2 has-focus-visible:ring-2 has-focus-visible:ring-ring',
                                        color === option
                                            ? 'border-foreground'
                                            : 'border-transparent',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="color"
                                        value={option}
                                        checked={color === option}
                                        onChange={() => setColor(option)}
                                        className="sr-only"
                                    />
                                    <span
                                        className={cn(
                                            'size-6 rounded-full',
                                            CATEGORY_COLORS[option],
                                        )}
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        {COLOR_LABELS[option] ?? option}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <InputError message={errors.color} />
                    </fieldset>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {category ? 'Guardar cambios' : 'Crear categoría'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

CategoriesIndex.layout = {
    breadcrumbs: [{ title: 'Categorías', href: categoriesIndex() }],
};
