import { Form, Head, usePage } from '@inertiajs/react';
import PreferencesController from '@/actions/App/Http/Controllers/Settings/PreferencesController';
import Heading from '@/components/heading';
import PreferencesFields from '@/components/preferences-fields';
import type { PreferenceOptions } from '@/components/preferences-fields';
import { Button } from '@/components/ui/button';
import { edit } from '@/routes/preferences';

type Props = {
    options: PreferenceOptions;
    canChangeCurrency: boolean;
};

export default function Preferences({ options, canChangeCurrency }: Props) {
    const { preferences } = usePage().props;

    return (
        <>
            <Head title="Preferencias" />

            <h1 className="sr-only">Preferencias</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Moneda y formato"
                    description="Elige tu moneda principal y cómo quieres ver los importes y las fechas."
                />

                <Form
                    {...PreferencesController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <PreferencesFields
                                options={options}
                                errors={errors}
                                defaults={preferences}
                                canChangeCurrency={canChangeCurrency}
                            />

                            <Button
                                disabled={processing}
                                data-test="update-preferences-button"
                            >
                                Guardar preferencias
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

Preferences.layout = {
    breadcrumbs: [{ title: 'Preferencias', href: edit() }],
};
