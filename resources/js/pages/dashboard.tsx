import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Landmark,
    PiggyBank,
    Settings2,
    Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { dashboard } from '@/routes';
import { edit as editPreferences } from '@/routes/preferences';

const upcoming: { icon: LucideIcon; title: string; text: string }[] = [
    {
        icon: Landmark,
        title: 'Cuentas',
        text: 'Tus cuentas bancarias, efectivo y otros depósitos, con su saldo.',
    },
    {
        icon: ArrowRightLeft,
        title: 'Ingresos y gastos',
        text: 'Registra movimientos previstos y confirmados por categoría.',
    },
    {
        icon: PiggyBank,
        title: 'Presupuestos y ahorro',
        text: 'Límites por categoría, objetivos y previsión de liquidez.',
    },
];

export default function Dashboard() {
    const { auth } = usePage().props;
    const format = useFormat();
    const firstName = auth.user.name.split(' ')[0];

    return (
        <>
            <Head title="Panel" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <Heading
                    title={`Hola, ${firstName}`}
                    description="Este es tu espacio para entender y organizar tu economía."
                />

                <section
                    aria-labelledby="empty-title"
                    className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-xs sm:flex-row sm:items-center"
                >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <Sparkles className="size-6" aria-hidden="true" />
                    </span>
                    <div className="flex-1 space-y-1">
                        <h2 id="empty-title" className="font-semibold">
                            Aún no hay datos que mostrar
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Cuando registres tus cuentas y movimientos, aquí
                            verás tu saldo, los próximos vencimientos y cuánto
                            podrías ahorrar. Tus importes se mostrarán así:{' '}
                            <strong className="text-foreground tabular-nums">
                                {format.money('1234.56')}
                            </strong>
                            .
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={editPreferences()}>
                            <Settings2 aria-hidden="true" />
                            Preferencias
                        </Link>
                    </Button>
                </section>

                <section aria-labelledby="upcoming-title" className="space-y-3">
                    <h2
                        id="upcoming-title"
                        className="text-sm font-medium text-muted-foreground"
                    >
                        Muy pronto
                    </h2>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {upcoming.map(({ icon: Icon, title, text }) => (
                            <li
                                key={title}
                                className="rounded-2xl border bg-card p-5 shadow-xs"
                            >
                                <Icon
                                    className="mb-3 size-5 text-primary"
                                    aria-hidden="true"
                                />
                                <h3 className="font-medium">{title}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {text}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Panel', href: dashboard() }],
};
