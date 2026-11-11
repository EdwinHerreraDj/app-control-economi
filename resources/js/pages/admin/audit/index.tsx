import { Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Pagination } from '@/components/pagination';
import { useFormat } from '@/hooks/use-format';
import { index as auditIndex } from '@/routes/admin/audit';
import type { Paginated } from '@/types';

type AuditEntry = {
    id: number;
    action: string;
    description: string;
    actor: string;
    subject: string | null;
    properties: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string | null;
};

const FIELD_LABELS: Record<string, string> = {
    name: 'nombre',
    email: 'correo',
    role: 'rol',
};

function details(entry: AuditEntry): string | null {
    const fields = entry.properties?.fields;

    if (Array.isArray(fields)) {
        return `Cambios: ${fields.map((f) => FIELD_LABELS[String(f)] ?? f).join(', ')}`;
    }

    return null;
}

export default function AuditIndex({ logs }: { logs: Paginated<AuditEntry> }) {
    const format = useFormat();

    return (
        <>
            <Head title="Auditoría" />

            <div className="flex flex-col gap-6 p-4">
                <Heading
                    title="Auditoría"
                    description="Registro de las acciones administrativas y de seguridad. No incluye contraseñas ni datos financieros."
                />

                {logs.data.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Todavía no hay acciones registradas.
                    </p>
                ) : (
                    <ol className="divide-y rounded-xl border">
                        {logs.data.map((entry) => (
                            <li
                                key={entry.id}
                                className="grid gap-1 p-4 text-sm"
                            >
                                <p className="font-medium">
                                    {entry.description}
                                    {entry.subject && (
                                        <span className="font-normal">
                                            {' '}
                                            · {entry.subject}
                                        </span>
                                    )}
                                </p>
                                {details(entry) && (
                                    <p className="text-muted-foreground">
                                        {details(entry)}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    <time
                                        dateTime={entry.created_at ?? undefined}
                                    >
                                        {format.dateTime(entry.created_at)}
                                    </time>{' '}
                                    · Por {entry.actor}
                                    {entry.ip_address &&
                                        ` · IP ${entry.ip_address}`}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}

                <Pagination page={logs} />
            </div>
        </>
    );
}

AuditIndex.layout = {
    breadcrumbs: [{ title: 'Auditoría', href: auditIndex() }],
};
