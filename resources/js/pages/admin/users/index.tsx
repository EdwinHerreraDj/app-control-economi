import { Form, Head, router } from '@inertiajs/react';
import {
    Ban,
    CircleCheck,
    Clock,
    KeyRound,
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
                        Invitar usuario
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
                                </div>

                                <UserActions
                                    user={user}
                                    onEdit={() =>
                                        setDialog({ type: 'edit', user })
                                    }
                                    onSuspend={() =>
                                        setDialog({ type: 'suspend', user })
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
        </>
    );
}

function UserActions({
    user,
    onEdit,
    onSuspend,
}: {
    user: AdminUser;
    onEdit: () => void;
    onSuspend: () => void;
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
                        {user ? `Editar a ${user.name}` : 'Invitar usuario'}
                    </DialogTitle>
                    <DialogDescription>
                        {user
                            ? 'Si cambias el correo de una cuenta activa, tendrá que volver a verificarlo.'
                            : 'Recibirá un correo con un enlace para establecer su contraseña. El enlace caduca en 72 horas.'}
                    </DialogDescription>

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

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {user ? 'Guardar cambios' : 'Enviar invitación'}
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
