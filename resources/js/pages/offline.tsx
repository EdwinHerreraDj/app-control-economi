import { Head, usePage } from '@inertiajs/react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AppLogo from '@/components/app-logo';
import { OfflineTransactionForm } from '@/components/offline/offline-transaction-form';
import { PendingOperations } from '@/components/offline/pending-operations';
import { Button } from '@/components/ui/button';
import { formatDay, formatMoney, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fromMinor, pendingEffect, toMinor } from '@/offline/money';
import type { ActiveUser } from '@/offline/storage';
import {
    bindStoredUser,
    bindUser,
    queueTransaction,
    syncNow,
    useSyncState,
} from '@/offline/sync';
import type { OfflineSnapshot, PendingOperation } from '@/offline/types';
import { useLocalData } from '@/offline/use-local-data';

/** A partir de este tiempo se avisa de que los datos pueden no estar al día. */
const STALE_MS = 24 * 60 * 60 * 1000;

/** Movimientos visibles al abrir; el resto, a petición. */
const RECENT_SHOWN = 15;

function Section({
    title,
    children,
    className,
}: {
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('space-y-3', className)}>
            <h2 className="text-base font-semibold">{title}</h2>
            {children}
        </section>
    );
}

function OfflineMascot({
    snapshot,
    operations,
}: {
    snapshot: OfflineSnapshot;
    operations: PendingOperation[];
}) {
    const mascot = snapshot.mascot;

    if (!mascot || mascot.visibility === 'hidden') {
        return null;
    }

    const prefs = snapshot.preferences;
    const age = Date.now() - new Date(snapshot.generated_at).getTime();
    const stale = age > STALE_MS;
    const pending = operations.length;
    const image = mascot.images[stale ? 'unknown' : 'idle'].static;

    // Los mensajes dicen siempre de cuándo son los datos y si falta algo.
    const message =
        pending > 0
            ? `Guardo ${pending === 1 ? '1 movimiento' : `${pending} movimientos`} en este dispositivo y ${pending === 1 ? 'lo enviaré' : 'los enviaré'} cuando vuelva la conexión. Los saldos sincronizados aún no ${pending === 1 ? 'lo incluyen' : 'los incluyen'}.`
            : stale
              ? `Estos datos son de ${formatRelative(snapshot.generated_at, prefs)}; puede que haya cambios que todavía no veo.`
              : `Te enseño tus datos de la última sincronización (${formatRelative(snapshot.generated_at, prefs)}).`;

    return (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            {image && (
                <img
                    src={image}
                    alt=""
                    className="size-16 shrink-0"
                    width={64}
                    height={64}
                />
            )}
            <p className="text-sm">
                <span className="font-medium">{mascot.name}: </span>
                {message}
            </p>
        </div>
    );
}

export default function Offline() {
    const { auth } = usePage().props;
    const sessionId = auth?.user?.id;
    const sessionName = auth?.user?.name;
    const [user, setUser] = useState<ActiveUser | null>(null);
    const [ready, setReady] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const { online, syncing, problem } = useSyncState();
    const { loading, snapshot, operations } = useLocalData(user?.id ?? null);

    // Con sesión (página abierta con conexión) se usa esa cuenta; si no, la
    // última que usó el dispositivo.
    useEffect(() => {
        const bind =
            sessionId !== undefined && sessionName !== undefined
                ? bindUser({ id: sessionId, name: sessionName }).then(() => ({
                      id: sessionId,
                      name: sessionName,
                  }))
                : bindStoredUser();

        void bind.then((bound) => {
            setUser(bound);
            setReady(true);

            if (bound && navigator.onLine) {
                void syncNow();
            }
        });
    }, [sessionId, sessionName]);

    useEffect(() => {
        const onOnline = () => void syncNow();
        window.addEventListener('online', onOnline);

        return () => window.removeEventListener('online', onOnline);
    }, []);

    const prefs = snapshot?.preferences;
    const decimals = prefs?.currency_decimals ?? 2;
    const effect = snapshot ? pendingEffect(operations, decimals) : new Map();
    const pendingTotal = [...effect.values()].reduce((a, b) => a + b, 0);

    return (
        <div className="min-h-svh bg-background">
            <Head title="Sin conexión" />

            <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <AppLogo />
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                                online
                                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                                    : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
                            )}
                            role="status"
                        >
                            {online ? (
                                <Wifi className="size-3.5" aria-hidden />
                            ) : (
                                <CloudOff className="size-3.5" aria-hidden />
                            )}
                            {online ? 'Con conexión' : 'Sin conexión'}
                        </span>
                        {online && (
                            <Button asChild size="sm">
                                <a href="/dashboard">Ir al panel</a>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold">Modo sin conexión</h1>
                    <p className="text-sm text-muted-foreground">
                        Consulta los datos guardados en este dispositivo y
                        registra ingresos o gastos: se enviarán a tu cuenta
                        cuando vuelva la conexión.
                    </p>
                </div>

                {!ready || loading ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                ) : !user || !snapshot || !prefs ? (
                    <div className="space-y-3 rounded-xl border p-5">
                        <p className="font-medium">
                            Aún no hay datos guardados en este dispositivo
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Abre la app con conexión e inicia sesión: tus datos
                            se guardarán aquí para poder consultarlos y
                            registrar movimientos sin conexión.
                        </p>
                        {online && (
                            <Button asChild>
                                <a href="/login">Iniciar sesión</a>
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <p className="text-muted-foreground">
                                Datos de{' '}
                                <span className="font-medium text-foreground">
                                    {snapshot.user.name}
                                </span>{' '}
                                · actualizados{' '}
                                {formatRelative(snapshot.generated_at, prefs)}
                            </p>
                            {online && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={syncing}
                                    onClick={() => void syncNow()}
                                >
                                    <RefreshCw
                                        className={cn(
                                            'size-4',
                                            syncing &&
                                                'motion-safe:animate-spin',
                                        )}
                                        aria-hidden
                                    />
                                    {syncing
                                        ? 'Sincronizando…'
                                        : 'Sincronizar ahora'}
                                </Button>
                            )}
                        </div>

                        {problem === 'login' && online && (
                            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                                Para enviar lo pendiente,{' '}
                                <a href="/login" className="underline">
                                    vuelve a iniciar sesión
                                </a>
                                . Lo registrado sigue guardado en este
                                dispositivo.
                            </p>
                        )}
                        {problem === 'other-account' && (
                            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                                La sesión abierta es de otra cuenta. Estos datos
                                son de {snapshot.user.name}: inicia sesión con
                                esa cuenta para sincronizarlos.
                            </p>
                        )}

                        <OfflineMascot
                            snapshot={snapshot}
                            operations={operations}
                        />

                        <Section title="Saldos">
                            <div className="rounded-xl border p-4">
                                <p className="text-sm text-muted-foreground">
                                    Saldo total sincronizado
                                </p>
                                <p className="text-2xl font-semibold tabular-nums">
                                    {formatMoney(
                                        snapshot.balance as `${number}`,
                                        prefs,
                                    )}
                                </p>
                                {pendingTotal !== 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Provisional con lo pendiente:{' '}
                                        <span className="font-medium text-foreground tabular-nums">
                                            {formatMoney(
                                                fromMinor(
                                                    toMinor(
                                                        snapshot.balance,
                                                        decimals,
                                                    ) + pendingTotal,
                                                    decimals,
                                                ) as `${number}`,
                                                prefs,
                                            )}
                                        </span>
                                    </p>
                                )}
                            </div>
                            <ul className="divide-y rounded-xl border">
                                {snapshot.accounts
                                    .filter((account) => !account.archived)
                                    .map((account) => {
                                        const extra =
                                            effect.get(account.id) ?? 0;

                                        return (
                                            <li
                                                key={account.id}
                                                className="flex items-baseline justify-between gap-3 px-4 py-3"
                                            >
                                                <span className="truncate text-sm">
                                                    {account.name}
                                                </span>
                                                <span className="text-right">
                                                    <span className="block font-medium tabular-nums">
                                                        {formatMoney(
                                                            account.balance as `${number}`,
                                                            prefs,
                                                        )}
                                                    </span>
                                                    {extra !== 0 && (
                                                        <span className="block text-xs text-muted-foreground tabular-nums">
                                                            Provisional:{' '}
                                                            {formatMoney(
                                                                fromMinor(
                                                                    toMinor(
                                                                        account.balance,
                                                                        decimals,
                                                                    ) + extra,
                                                                    decimals,
                                                                ) as `${number}`,
                                                                prefs,
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                            </li>
                                        );
                                    })}
                            </ul>
                            <p className="text-xs text-muted-foreground">
                                Los saldos provisionales suman lo registrado sin
                                conexión como ya cobrado o pagado. Al
                                sincronizar, el servidor los recalcula.
                            </p>
                        </Section>

                        <Section title="Registrar un movimiento">
                            <div className="rounded-xl border p-4">
                                <OfflineTransactionForm
                                    snapshot={snapshot}
                                    onSubmit={async (payload, labels) => {
                                        await queueTransaction(
                                            user.id,
                                            payload,
                                            labels,
                                        );
                                        toast.success(
                                            navigator.onLine
                                                ? 'Guardado. Enviándolo a tu cuenta…'
                                                : 'Guardado en este dispositivo. Se enviará cuando vuelva la conexión.',
                                        );

                                        if (navigator.onLine) {
                                            void syncNow();
                                        }
                                    }}
                                />
                            </div>
                        </Section>

                        <Section title="Pendiente de sincronizar">
                            <PendingOperations
                                userId={user.id}
                                snapshot={snapshot}
                                operations={operations}
                            />
                        </Section>

                        {snapshot.upcoming.length > 0 && (
                            <Section title="Próximos cobros y pagos">
                                <ul className="divide-y rounded-xl border">
                                    {snapshot.upcoming.map((item) => (
                                        <li
                                            key={`${item.type}-${item.id}`}
                                            className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm"
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate">
                                                    {item.concept}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {formatDay(
                                                        item.date,
                                                        prefs,
                                                    )}
                                                    {item.overdue
                                                        ? ' · vencido'
                                                        : ''}
                                                </span>
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {item.amount
                                                    ? `${item.kind === 'income' ? '+' : '−'}${formatMoney(item.amount as `${number}`, prefs)}`
                                                    : '—'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        <Section title="Últimos movimientos sincronizados">
                            {snapshot.recent.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Todavía no hay movimientos.
                                </p>
                            ) : (
                                <>
                                    <ul className="divide-y rounded-xl border">
                                        {snapshot.recent
                                            .slice(
                                                0,
                                                showAll
                                                    ? undefined
                                                    : RECENT_SHOWN,
                                            )
                                            .map((item) => {
                                                const positive =
                                                    item.kind === 'income' ||
                                                    item.kind === 'debt_in';
                                                const transfer =
                                                    item.kind ===
                                                    'transfer_out';

                                                return (
                                                    <li
                                                        key={item.uuid}
                                                        className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm"
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="block truncate">
                                                                {item.concept}
                                                            </span>
                                                            <span className="block text-xs text-muted-foreground">
                                                                {formatDay(
                                                                    item.occurred_on,
                                                                    prefs,
                                                                )}{' '}
                                                                · {item.account}
                                                                {item.status ===
                                                                'planned'
                                                                    ? ' · previsto'
                                                                    : ''}
                                                                {transfer
                                                                    ? ' · transferencia'
                                                                    : ''}
                                                            </span>
                                                        </span>
                                                        <span className="font-medium tabular-nums">
                                                            {transfer
                                                                ? ''
                                                                : positive
                                                                  ? '+'
                                                                  : '−'}
                                                            {formatMoney(
                                                                item.amount as `${number}`,
                                                                prefs,
                                                                item.currency,
                                                            )}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                    </ul>
                                    {!showAll &&
                                        snapshot.recent.length >
                                            RECENT_SHOWN && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowAll(true)}
                                            >
                                                Mostrar los{' '}
                                                {snapshot.recent.length}
                                            </Button>
                                        )}
                                </>
                            )}
                        </Section>
                    </>
                )}
            </main>
        </div>
    );
}
