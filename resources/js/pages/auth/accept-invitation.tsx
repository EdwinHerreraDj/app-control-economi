import { Form, Head } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import InvitationController from '@/actions/App/Http/Controllers/Auth/InvitationController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';

type Props = {
    token: string;
    email: string;
    name: string | null;
    valid: boolean;
    passwordRules: string;
};

export default function AcceptInvitation({
    token,
    email,
    name,
    valid,
    passwordRules,
}: Props) {
    if (!valid) {
        return (
            <>
                <Head title="Invitación no válida" />

                <Alert>
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>Este enlace ya no sirve</AlertTitle>
                    <AlertDescription>
                        Puede que haya caducado, que ya se haya usado o que se
                        haya enviado una invitación más reciente. Pide al
                        administrador que te envíe una nueva.
                    </AlertDescription>
                </Alert>

                <p className="text-center text-sm text-muted-foreground">
                    ¿Ya activaste tu cuenta?{' '}
                    <TextLink href={login()}>Inicia sesión</TextLink>
                </p>
            </>
        );
    }

    return (
        <>
            <Head title="Activa tu cuenta" />

            {name && (
                <p className="text-center text-sm">
                    Hola, <strong>{name}</strong>. Elige una contraseña para
                    empezar.
                </p>
            )}

            <Form
                {...InvitationController.store.form()}
                transform={(data) => ({ ...data, token, email })}
                resetOnError={['password', 'password_confirmation']}
            >
                {({ processing, errors }) => (
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="username"
                                value={email}
                                readOnly
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                autoFocus
                                required
                                passwordrules={passwordRules}
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">
                                Repite la contraseña
                            </Label>
                            <PasswordInput
                                id="password_confirmation"
                                name="password_confirmation"
                                autoComplete="new-password"
                                required
                                passwordrules={passwordRules}
                            />
                            <InputError
                                message={errors.password_confirmation}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={processing}
                            data-test="accept-invitation-button"
                        >
                            {processing && <Spinner />}
                            Activar mi cuenta
                        </Button>
                    </div>
                )}
            </Form>
        </>
    );
}

AcceptInvitation.layout = {
    title: 'Activa tu cuenta',
    description: 'Establece la contraseña con la que entrarás a la aplicación',
};
