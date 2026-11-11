import { Form, Head, usePage } from '@inertiajs/react';
import OnboardingController from '@/actions/App/Http/Controllers/OnboardingController';
import PreferencesFields from '@/components/preferences-fields';
import type { PreferenceOptions } from '@/components/preferences-fields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { browserTimeZone } from '@/lib/format';

export default function Onboarding({
    options,
}: {
    options: PreferenceOptions;
}) {
    const { auth, preferences } = usePage().props;

    // La zona horaria se sugiere a partir del navegador; la moneda no se
    // deduce de nada: la elige siempre la persona.
    const suggestedTimezone = browserTimeZone();
    const timezone =
        suggestedTimezone && options.timezones.includes(suggestedTimezone)
            ? suggestedTimezone
            : preferences.timezone;

    return (
        <>
            <Head title="Primera configuración" />

            <p className="text-center text-sm">
                Hola, <strong>{auth.user.name}</strong>. Antes de empezar,
                cuéntanos cómo quieres ver tus cuentas. Podrás cambiarlo después
                en Configuración.
            </p>

            <Form {...OnboardingController.store.form()} className="grid gap-6">
                {({ errors, processing }) => (
                    <>
                        <PreferencesFields
                            options={options}
                            errors={errors}
                            defaults={{
                                currency: null,
                                number_locale: preferences.number_locale,
                                timezone,
                                locale: preferences.locale,
                            }}
                        />

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={processing}
                            data-test="onboarding-submit"
                        >
                            {processing && <Spinner />}
                            Empezar
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

Onboarding.layout = {
    title: 'Te damos la bienvenida',
    description: 'Solo te llevará un momento',
};
