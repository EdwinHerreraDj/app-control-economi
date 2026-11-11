import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeftRight, Landmark, Minus, Plus, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Heading from '@/components/heading';
import { dashboard } from '@/routes';
import { index as accountsIndex } from '@/routes/accounts';
import { index as transactionsIndex } from '@/routes/transactions';

const quickActions: {
    icon: LucideIcon;
    title: string;
    text: string;
    href: ReturnType<typeof dashboard>;
}[] = [
    {
        icon: Minus,
        title: 'Añadir gasto',
        text: 'Un pago hecho o uno previsto.',
        href: transactionsIndex({ query: { new: 'expense' } }),
    },
    {
        icon: Plus,
        title: 'Añadir ingreso',
        text: 'Un cobro recibido o por recibir.',
        href: transactionsIndex({ query: { new: 'income' } }),
    },
    {
        icon: ArrowLeftRight,
        title: 'Transferir',
        text: 'Mover dinero entre tus cuentas.',
        href: transactionsIndex({ query: { new: 'transfer' } }),
    },
    {
        icon: Landmark,
        title: 'Mis cuentas',
        text: 'Saldo real de cada cuenta.',
        href: accountsIndex(),
    },
];

export default function Dashboard() {
    const { auth } = usePage().props;
    const firstName = auth.user.name.split(' ')[0];

    return (
        <>
            <Head title="Panel" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <Heading
                    title={`Hola, ${firstName}`}
                    description="Este es tu espacio para entender y organizar tu economía."
                />

                <section aria-labelledby="quick-title" className="space-y-3">
                    <h2
                        id="quick-title"
                        className="text-sm font-medium text-muted-foreground"
                    >
                        Acciones rápidas
                    </h2>
                    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {quickActions.map(
                            ({ icon: Icon, title, text, href }) => (
                                <li key={title}>
                                    <Link
                                        href={href}
                                        className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent/40"
                                    >
                                        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <Icon
                                                className="size-5"
                                                aria-hidden="true"
                                            />
                                        </span>
                                        <span className="font-medium">
                                            {title}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {text}
                                        </span>
                                    </Link>
                                </li>
                            ),
                        )}
                    </ul>
                </section>

                <section
                    aria-labelledby="soon-title"
                    className="flex gap-4 rounded-2xl border bg-card p-5 shadow-xs"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <Sparkles className="size-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1">
                        <h2 id="soon-title" className="font-semibold">
                            Tu resumen llegará pronto
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Con tus cuentas y movimientos, aquí verás el saldo,
                            los próximos vencimientos y una previsión de tu
                            liquidez, siempre explicando en qué datos se basa.
                        </p>
                    </div>
                </section>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Panel', href: dashboard() }],
};
