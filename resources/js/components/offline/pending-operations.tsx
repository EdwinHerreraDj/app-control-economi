import { AlertTriangle, Clock, Copy } from 'lucide-react';
import { useState } from 'react';
import { OfflineTransactionForm } from '@/components/offline/offline-transaction-form';
import { Button } from '@/components/ui/button';
import { formatDay, formatMoney } from '@/lib/format';
import {
    confirmDuplicate,
    discardOperation,
    syncNow,
    updateOperation,
} from '@/offline/sync';
import type { OfflineSnapshot, PendingOperation } from '@/offline/types';

const STATE_LABEL: Record<
    PendingOperation['state'],
    { text: string; icon: typeof Clock; className: string }
> = {
    pending: {
        text: 'Pendiente de enviar',
        icon: Clock,
        className: 'text-muted-foreground',
    },
    rejected: {
        text: 'No se ha podido registrar',
        icon: AlertTriangle,
        className: 'text-destructive',
    },
    conflict: {
        text: 'Posible duplicado',
        icon: Copy,
        className: 'text-amber-700 dark:text-amber-400',
    },
};

/**
 * Movimientos registrados en el dispositivo que aún no están en el servidor.
 * Los rechazados y los posibles duplicados nunca se resuelven solos: la
 * persona decide corregir, registrar igualmente o descartar.
 */
export function PendingOperations({
    userId,
    snapshot,
    operations,
}: {
    userId: number;
    snapshot: OfflineSnapshot;
    operations: PendingOperation[];
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const prefs = snapshot.preferences;

    if (operations.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No hay nada pendiente: todo lo registrado en este dispositivo ya
                está en tu cuenta.
            </p>
        );
    }

    const discard = (operation: PendingOperation) => {
        if (
            window.confirm(
                `¿Descartar «${operation.payload.concept}»? Se borrará de este dispositivo y no se registrará.`,
            )
        ) {
            void discardOperation(userId, operation.uuid);
        }
    };

    return (
        <ul className="divide-y rounded-xl border">
            {operations.map((operation) => {
                const { payload } = operation;
                const label = STATE_LABEL[operation.state];
                const Icon = label.icon;
                const sign = payload.kind === 'income' ? '+' : '−';

                return (
                    <li key={operation.uuid} className="space-y-3 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate font-medium">
                                    {payload.concept}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {payload.kind === 'income'
                                        ? 'Ingreso'
                                        : 'Gasto'}
                                    {payload.status === 'planned'
                                        ? ' pendiente'
                                        : ''}{' '}
                                    · {formatDay(payload.occurred_on, prefs)} ·{' '}
                                    {operation.labels.account} ·{' '}
                                    {operation.labels.category}
                                </p>
                            </div>
                            <p className="font-medium tabular-nums">
                                {sign}
                                {formatMoney(
                                    payload.amount as `${number}`,
                                    prefs,
                                )}
                            </p>
                        </div>

                        <p
                            className={`flex items-center gap-1.5 text-xs font-medium ${label.className}`}
                        >
                            <Icon className="size-3.5" aria-hidden />
                            {label.text}
                        </p>

                        {operation.errors && (
                            <ul className="list-inside list-disc text-sm text-muted-foreground">
                                {Object.values(operation.errors)
                                    .flat()
                                    .map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                            </ul>
                        )}

                        {operation.duplicate && (
                            <p className="rounded-md bg-muted/60 p-2 text-sm">
                                Ya registrado: «{operation.duplicate.concept}»,{' '}
                                {formatDay(
                                    operation.duplicate.occurred_on,
                                    prefs,
                                )}
                                ,{' '}
                                {formatMoney(
                                    operation.duplicate.amount as `${number}`,
                                    prefs,
                                )}
                                .
                            </p>
                        )}

                        {editing === operation.uuid ? (
                            <OfflineTransactionForm
                                snapshot={snapshot}
                                operation={operation}
                                submitLabel="Guardar y reenviar"
                                onCancel={() => setEditing(null)}
                                onSubmit={async (next, labels) => {
                                    await updateOperation(
                                        userId,
                                        operation,
                                        next,
                                        labels,
                                    );
                                    setEditing(null);
                                    void syncNow();
                                }}
                            />
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {operation.state === 'conflict' && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            void confirmDuplicate(
                                                userId,
                                                operation,
                                            ).then(() => syncNow());
                                        }}
                                    >
                                        Registrar igualmente
                                    </Button>
                                )}
                                {operation.state === 'rejected' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            setEditing(operation.uuid)
                                        }
                                    >
                                        Corregir
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => discard(operation)}
                                >
                                    {operation.state === 'conflict'
                                        ? 'Es el mismo: descartar'
                                        : 'Descartar'}
                                </Button>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
