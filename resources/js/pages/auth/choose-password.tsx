import { Form, Head } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import ChoosePasswordController from '@/actions/App/Http/Controllers/Auth/ChoosePasswordController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';

export default function ChoosePassword({
    passwordRules,
}: {
    passwordRules: string;
}) {
    return (
        <>
            <Head title="Elige tu contraseña" />

            <p className="flex gap-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                />
                Entraste con una contraseña temporal que te dio el
                administrador. Elige una nueva que solo conozcas tú para seguir.
            </p>

            <Form
                {...ChoosePasswordController.store.form()}
                resetOnError
                className="grid gap-6"
            >
                {({ errors, processing }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Nueva contraseña</Label>
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
                            data-test="choose-password-button"
                        >
                            {processing && <Spinner />}
                            Guardar y continuar
                        </Button>

                        <TextLink href={logout()} className="mx-auto text-sm">
                            Cerrar sesión
                        </TextLink>
                    </>
                )}
            </Form>
        </>
    );
}

ChoosePassword.layout = {
    title: 'Elige tu contraseña',
    description: 'Solo tendrás que hacerlo esta vez',
};
