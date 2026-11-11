import { Form, Head } from '@inertiajs/react';
import { Monitor, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFormat } from '@/hooks/use-format';
import { edit } from '@/routes/security';

type Session = {
    id: string;
    ip_address: string | null;
    agent: { browser: string; platform: string; is_mobile: boolean };
    last_active: string;
    is_current: boolean;
};

type Props = {
    passwordRules: string;
    sessions: Session[];
};

export default function Security({ passwordRules, sessions }: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <>
            <Head title="Seguridad" />

            <h1 className="sr-only">Seguridad</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Cambiar la contraseña"
                    description="Usa una contraseña larga y difícil de adivinar. Al cambiarla se cerrará la sesión en tus otros dispositivos."
                />

                <Form
                    {...SecurityController.update.form()}
                    options={{ preserveScroll: true }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="current_password">
                                    Contraseña actual
                                </Label>
                                <PasswordInput
                                    id="current_password"
                                    ref={currentPasswordInput}
                                    name="current_password"
                                    autoComplete="current-password"
                                />
                                <InputError message={errors.current_password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">
                                    Nueva contraseña
                                </Label>
                                <PasswordInput
                                    id="password"
                                    ref={passwordInput}
                                    name="password"
                                    autoComplete="new-password"
                                    passwordrules={passwordRules}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Repite la nueva contraseña
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    autoComplete="new-password"
                                    passwordrules={passwordRules}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button
                                disabled={processing}
                                data-test="update-password-button"
                            >
                                Guardar contraseña
                            </Button>
                        </>
                    )}
                </Form>
            </div>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Dispositivos con sesión abierta"
                    description="Si no reconoces alguno, cierra las demás sesiones y cambia tu contraseña."
                />

                {sessions.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                        {sessions.map((session) => (
                            <SessionRow key={session.id} session={session} />
                        ))}
                    </ul>
                )}

                <LogoutOtherSessions />
            </div>
        </>
    );
}

function SessionRow({ session }: { session: Session }) {
    const format = useFormat();
    const Icon = session.agent.is_mobile ? Smartphone : Monitor;

    return (
        <li className="flex items-center gap-3 p-3">
            <Icon
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
            />
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                    {session.agent.platform} · {session.agent.browser}
                </p>
                <p className="text-muted-foreground">
                    {session.ip_address ?? 'IP desconocida'} ·{' '}
                    {session.is_current
                        ? 'Activo ahora'
                        : `Última actividad ${format.relative(session.last_active)}`}
                </p>
            </div>
            {session.is_current && (
                <Badge variant="secondary">Este dispositivo</Badge>
            )}
        </li>
    );
}

function LogoutOtherSessions() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    Cerrar sesión en los demás dispositivos
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Cerrar las demás sesiones</DialogTitle>
                <DialogDescription>
                    Se cerrará la sesión en todos tus otros dispositivos,
                    incluidos los que tenían activado «mantener la sesión». Este
                    dispositivo seguirá conectado. Confirma tu contraseña para
                    continuar.
                </DialogDescription>

                <Form
                    {...SecurityController.destroyOtherSessions.form()}
                    options={{ preserveScroll: true }}
                    resetOnError
                    resetOnSuccess
                    onSuccess={() => setOpen(false)}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="logout_password">
                                    Contraseña
                                </Label>
                                <PasswordInput
                                    id="logout_password"
                                    name="password"
                                    autoComplete="current-password"
                                    autoFocus
                                />
                                <InputError message={errors.password} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    Cerrar las demás sesiones
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Seguridad',
            href: edit(),
        },
    ],
};
