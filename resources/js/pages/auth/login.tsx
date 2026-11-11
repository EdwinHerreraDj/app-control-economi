import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Iniciar sesión" />

            {status && (
                <div
                    role="status"
                    className="rounded-md border bg-muted px-4 py-3 text-center text-sm font-medium"
                >
                    {status}
                </div>
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoFocus
                                autoComplete="email"
                                placeholder="tu@correo.com"
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center">
                                <Label htmlFor="password">Contraseña</Label>
                                {canResetPassword && (
                                    <TextLink
                                        href={request()}
                                        className="ml-auto text-sm"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </TextLink>
                                )}
                            </div>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                autoComplete="current-password"
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox
                                id="remember"
                                name="remember"
                                defaultChecked
                                aria-describedby="remember-hint"
                            />
                            <div className="grid gap-1">
                                <Label htmlFor="remember">
                                    Mantener la sesión en este dispositivo
                                </Label>
                                <p
                                    id="remember-hint"
                                    className="text-xs text-muted-foreground"
                                >
                                    Úsalo solo en dispositivos de confianza.
                                    Puedes cerrar la sesión de otros
                                    dispositivos desde Seguridad.
                                </p>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="mt-2 w-full"
                            disabled={processing}
                            data-test="login-button"
                        >
                            {processing && <Spinner />}
                            Entrar
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            ¿No tienes cuenta? El administrador te enviará una
                            invitación por correo.
                        </p>
                    </div>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: 'Inicia sesión',
    description: 'Introduce tu correo y tu contraseña para entrar',
};
