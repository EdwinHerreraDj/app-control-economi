import { Form, Head, router } from '@inertiajs/react';
import {
    Ban,
    CircleCheck,
    Clock,
    KeyRound,
    LockKeyhole,
    Mail,
    MoreHorizontal,
    Pencil,
    RotateCcw,
    Search,
    ShieldCheck,
    UserPlus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Pagination } from '@/components/pagination';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { index as usersIndex } from '@/routes/admin/users';
import type { Paginated, UserRole, UserStatus } from '@/types';

type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    email_verified: boolean;
    must_change_password: boolean;
    invited_at: string | null;
    activated_at: string | null;
    created_at: string | null;
    is_current: boolean;
};

type Props = {
    users: Paginated<AdminUser>;
    filters: { search: string };
    roles: { value: UserRole; label: string }[];
    statuses: Record<UserStatus, string>;
};

type DialogState =
    | { type: 'create' }
    | { type: 'edit'; user: AdminUser }
    | { type: 'suspend'; user: AdminUser }
    | { type: 'password'; user: AdminUser }
    | null;

const STATUS_ICON: Record<UserStatus, ReactNode> = {
    active: <CircleCheck aria-hidden="true" />,
    pending: <Clock aria-hidden="true" />,
    suspended: <Ban aria-hidden="true" />,
};

/** Acciones de un clic: muestran el primer error de validación como aviso. */
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

export default function UsersIndex({ users, filters, roles, statuses }: Props) {
    const format = useFormat();
    const [dialog, setDialog] = useState<DialogState>(null);
    const roleLabel = (role: UserRole) =>
        roles.find((r) => r.value === role)?.label ?? role;

    return (
        <>
            <Head title="Usuarios" />

            <div className="flex flex-col gap-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Usuarios"
                        description="Da de alta cuentas y gestiona su acceso. Desde aquí no se ve la información financiera de nadie."
                    />
                    <Button onClick={() => setDialog({ type: 'create' })}>
                        <UserPlus aria-hidden="true" />
                        Nuevo usuario
                    </Button>
                </div>

                <form
                    role="search"
                    className="relative max-w-sm"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const value = new FormData(event.currentTarget).get(
                            'search',
                        );
                        const search =
                            typeof value === 'string' ? value.trim() : '';
                        router.get(
                            usersIndex.url({
                                query: search ? { search } : {},
                            }),
                            {},
                            { preserveState: true },
                        );
                    }}
                >
                    <Label htmlFor="search" className="sr-only">
                        Buscar por nombre o correo
                    </Label>
                    <Search
                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        id="search"
                        name="search"
                        type="search"
                        defaultValue={filters.search}
                        placeholder="Buscar por nombre o correo"
                        className="pl-9"
                    />
                </form>

                {users.data.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        {filters.search
                            ? 'Ningún usuario coincide con la búsqueda.'
                            : 'Todavía no hay usuarios.'}
                    </p>
                ) : (
                    <ul className="divide-y rounded-xl border">
                        {users.data.map((user) => (
                            <li
                                key={user.id}
                                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
                            >
                                <div className="min-w-0 flex-1 basis-64">
                                    <p className="flex flex-wrap items-center gap-2 font-medium">
                                        <span className="truncate">
                                            {user.name}
                                        </span>
                                        {user.is_current && (
                                            <span className="text-xs font-normal text-muted-foreground">
                                                (tú)
                                            </span>
                                        )}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {user.email}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {user.status === 'pending'
                                            ? `Invitado el ${format.dateTime(user.invited_at)}`
                                            : `Alta el ${format.dateTime(user.created_at)}`}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {user.role === 'superuser' && (
                                        <Badge variant="default">
                                            <ShieldCheck aria-hidden="true" />
                                            {roleLabel(user.role)}
                                        </Badge>
                                    )}
                                    <Badge
                                        variant={
                                            user.status === 'active'
                                                ? 'secondary'
                                                : 'outline'
                                        }
                                    >
                                        {STATUS_ICON[user.status]}
                                        {statuses[user.status]}
                                    </Badge>
                                    {user.must_change_password && (
                                        <Badge variant="outline">
                                            <KeyRound aria-hidden="true" />
                                            Debe cambiar la contraseña
                                        </Badge>
                                    )}
                                </div>

                                <UserActions
                                    user={user}
                                    onEdit={() =>
                                        setDialog({ type: 'edit', user })
                                    }
                                    onSuspend={() =>
                                        setDialog({ type: 'suspend', user })
                                    }
                                    onSetPassword={() =>
                                        setDialog({ type: 'password', user })
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination page={users} />
            </div>

            <Dialog
                open={dialog?.type === 'create' || dialog?.type === 'edit'}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent>
                    {(dialog?.type === 'create' || dialog?.type === 'edit') && (
                        <UserForm
                            user={dialog.type === 'edit' ? dialog.user : null}
                            roles={roles}
                            onDone={() => setDialog(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={dialog?.type === 'suspend'}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent>
                    {dialog?.type === 'suspend' && (
                        <>
                            <DialogTitle>
                                ¿Suspender a {dialog.user.name}?
                            </DialogTitle>
                            <DialogDescription>
                                No podrá iniciar sesión y se cerrarán sus
                                sesiones abiertas en todos sus dispositivos. Sus
                                datos se conservan y podrás reactivar la cuenta
                                cuando quieras.
                            </DialogDescription>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        postAction(
                                            UserController.suspend.url(
                                                dialog.user.id,
                                            ),
                                        );
                                        setDialog(null);
                                    }}
                                >
                                    Suspender cuenta
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={dialog?.type === 'password'}
                onOpenChange={(open) => !open && setDialog(null)}
            >
                <DialogContent>
                    {dialog?.type === 'password' && (
                        <TemporaryPasswordForm
                            user={dialog.user}
                            onDone={() => setDialog(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function UserActions({
    user,
    onEdit,
    onSuspend,
    onSetPassword,
}: {
    user: AdminUser;
    onEdit: () => void;
    onSuspend: () => void;
    onSetPassword: () => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Acciones para ${user.name}`}
                >
                    <MoreHorizontal aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                    <Pencil aria-hidden="true" />
                    Editar
                </DropdownMenuItem>

                {user.status === 'pending' && (
                    <DropdownMenuItem
                        onSelect={() =>
                            postAction(
                                UserController.resendInvitation.url(user.id),
                            )
                        }
                    >
                        <Mail aria-hidden="true" />
                        Reenviar invitación
                    </DropdownMenuItem>
                )}

                {user.status === 'active' && (
                    <DropdownMenuItem
                        onSelect={() =>
                            postAction(
                                UserController.sendPasswordReset.url(user.id),
                            )
                        }
                    >
                        <KeyRound aria-hidden="true" />
                        Enviar enlace de recuperación
                    </DropdownMenuItem>
                )}

                {!user.is_current && user.status !== 'suspended' && (
                    <DropdownMenuItem onSelect={onSetPassword}>
                        <LockKeyhole aria-hidden="true" />
                        Poner contraseña temporal
                    </DropdownMenuItem>
                )}

                {!user.is_current && (
                    <>
                        <DropdownMenuSeparator />
                        {user.status === 'suspended' ? (
                            <DropdownMenuItem
                                onSelect={() =>
                                    postAction(
                                        UserController.reactivate.url(user.id),
                                    )
                                }
                            >
                                <RotateCcw aria-hidden="true" />
                                Reactivar cuenta
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={onSuspend}
                            >
                                <Ban aria-hidden="true" />
                                Suspender cuenta
                            </DropdownMenuItem>
                        )}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function UserForm({
    user,
    roles,
    onDone,
}: {
    user: AdminUser | null;
    roles: Props['roles'];
    onDone: () => void;
}) {
    const [mode, setMode] = useState<'invite' | 'password'>('invite');
    const form = user
        ? UserController.update.form(user.id)
        : UserController.store.form();

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
                        {user ? `Editar a ${user.name}` : 'Nuevo usuario'}
                    </DialogTitle>
                    <DialogDescription>
                        {user
                            ? 'Si cambias el correo de una cuenta activa, tendrá que volver a verificarlo.'
                            : 'Elige cómo dar de alta la cuenta. El correo es su usuario para iniciar sesión.'}
                    </DialogDescription>

                    {!user && (
                        <fieldset className="grid gap-2">
                            <legend className="mb-1 text-sm font-medium">
                                Forma de alta
                            </legend>
                            {(
                                [
                                    [
                                        'invite',
                                        'Enviar invitación por correo',
                                        'Recibirá un enlace (válido 72 horas) para elegir su contraseña.',
                                    ],
                                    [
                                        'password',
                                        'Crear con una contraseña temporal',
                                        'No se envía ningún correo. Al entrar por primera vez tendrá que elegir la suya.',
                                    ],
                                ] as const
                            ).map(([value, label, hint]) => (
                                <label
                                    key={value}
                                    className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
                                >
                                    <input
                                        type="radio"
                                        name="mode"
                                        value={value}
                                        checked={mode === value}
                                        onChange={() => setMode(value)}
                                        className="mt-0.5 accent-primary"
                                    />
                                    <span>
                                        <span className="font-medium">
                                            {label}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {hint}
                                        </span>
                                    </span>
                                </label>
                            ))}
                            <InputError message={errors.mode} />
                        </fieldset>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="user-name">Nombre</Label>
                        <Input
                            id="user-name"
                            name="name"
                            defaultValue={user?.name}
                            required
                            autoComplete="off"
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="user-email">Correo electrónico</Label>
                        <Input
                            id="user-email"
                            name="email"
                            type="email"
                            defaultValue={user?.email}
                            required
                            autoComplete="off"
                        />
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="user-role">Rol</Label>
                        <Select
                            name="role"
                            defaultValue={user?.role ?? 'user'}
                            disabled={user?.is_current}
                        >
                            <SelectTrigger id="user-role" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem
                                        key={role.value}
                                        value={role.value}
                                    >
                                        {role.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {user?.is_current ? (
                            // Un select deshabilitado no se envía con el formulario.
                            <p className="text-xs text-muted-foreground">
                                <input
                                    type="hidden"
                                    name="role"
                                    value={user.role}
                                />
                                No puedes cambiar el rol de tu propia cuenta.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                El superusuario administra cuentas y la
                                configuración global, pero no ve las finanzas de
                                otros usuarios.
                            </p>
                        )}
                        <InputError message={errors.role} />
                    </div>

                    {!user && mode === 'password' && (
                        <TemporaryPasswordFields errors={errors} />
                    )}

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {user
                                ? 'Guardar cambios'
                                : mode === 'password'
                                  ? 'Crear cuenta'
                                  : 'Enviar invitación'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

function TemporaryPasswordFields({
    errors,
}: {
    errors: Partial<Record<string, string>>;
}) {
    return (
        <div className="grid gap-4 rounded-xl border p-4">
            <div className="grid gap-2">
                <Label htmlFor="temp-password">Contraseña temporal</Label>
                <PasswordInput
                    id="temp-password"
                    name="password"
                    autoComplete="new-password"
                    required
                />
                <InputError message={errors.password} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="temp-password-confirmation">
                    Repite la contraseña
                </Label>
                <PasswordInput
                    id="temp-password-confirmation"
                    name="password_confirmation"
                    autoComplete="new-password"
                    required
                />
                <InputError message={errors.password_confirmation} />
            </div>
            <p className="text-xs text-muted-foreground">
                Comunícasela por un canal seguro (en persona o por teléfono). Al
                entrar tendrá que cambiarla, así que dejarás de conocerla.
            </p>
        </div>
    );
}

function TemporaryPasswordForm({
    user,
    onDone,
}: {
    user: AdminUser;
    onDone: () => void;
}) {
    return (
        <Form
            {...UserController.setTemporaryPassword.form(user.id)}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            resetOnError
            className="space-y-6"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>
                        Contraseña temporal para {user.name}
                    </DialogTitle>
                    <DialogDescription>
                        Útil si no puede recuperar su contraseña por correo. Se
                        cerrarán sus sesiones abiertas y, al volver a entrar,
                        tendrá que elegir una nueva.
                    </DialogDescription>
                    <TemporaryPasswordFields errors={errors} />
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            Guardar contraseña temporal
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

UsersIndex.layout = {
    breadcrumbs: [{ title: 'Usuarios', href: usersIndex() }],
};
