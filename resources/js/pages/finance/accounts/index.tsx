import { Form, Head, Link, router } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    Banknote,
    Info,
    Landmark,
    MoreHorizontal,
    Pencil,
    PiggyBank,
    Plus,
    Vault,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import AccountController from '@/actions/App/Http/Controllers/Finance/AccountController';
import AmountInput from '@/components/finance/amount-input';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { normalizeAmount } from '@/lib/amount';
import { index as accountsIndex } from '@/routes/accounts';
import { index as transactionsIndex } from '@/routes/transactions';

type Account = {
    id: number;
    name: string;
    type: string;
    type_label: string;
    currency: string;
    initial_balance: string;
    balance: string;
    archived: boolean;
    transactions_count: number;
};

type Props = {
    accounts: Account[];
    total: string;
    types: { value: string; label: string }[];
};

const TYPE_ICONS: Record<string, LucideIcon> = {
    bank: Landmark,
    savings: PiggyBank,
    cash: Banknote,
    other: Vault,
};

function postAction(url: string) {
    router.post(
        url,
        {},
        {
            preserveScroll: true,
            onError: (errors) => {
                const first = Object.values(errors)[0];

                if (first) {
                    toast.error(first);
                }
            },
        },
    );
}

export default function AccountsIndex({ accounts, total, types }: Props) {
    const format = useFormat();
    const [editing, setEditing] = useState<Account | 'new' | null>(null);
    const active = accounts.filter((account) => !account.archived);
    const archived = accounts.filter((account) => account.archived);

    return (
        <>
            <Head title="Cuentas" />

            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Cuentas"
                        description="Tus cuentas bancarias, efectivo y otros depósitos."
                    />
                    <Button onClick={() => setEditing('new')}>
                        <Plus aria-hidden="true" />
                        Nueva cuenta
                    </Button>
                </div>

                {active.length > 0 && (
                    <section
                        aria-label="Saldo total"
                        className="rounded-2xl border bg-card p-5 shadow-xs"
                    >
                        <p className="text-sm text-muted-foreground">
                            Saldo real de tus cuentas activas
                        </p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums">
                            {format.money(total)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Incluye los movimientos confirmados. Los previstos
                            todavía no se descuentan.
                        </p>
                    </section>
                )}

                {accounts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                        <Landmark
                            className="mx-auto mb-3 size-8 text-primary"
                            aria-hidden="true"
                        />
                        <h2 className="font-semibold">
                            Añade tu primera cuenta
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                            Empieza por la cuenta donde cobras o el efectivo que
                            llevas encima. Indica el saldo que tiene hoy y, a
                            partir de ahí, registra tus movimientos.
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => setEditing('new')}
                        >
                            <Plus aria-hidden="true" />
                            Nueva cuenta
                        </Button>
                    </div>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {active.map((account) => (
                            <AccountCard
                                key={account.id}
                                account={account}
                                onEdit={() => setEditing(account)}
                            />
                        ))}
                    </ul>
                )}

                {archived.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            Archivadas
                        </h2>
                        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {archived.map((account) => (
                                <AccountCard
                                    key={account.id}
                                    account={account}
                                    onEdit={() => setEditing(account)}
                                />
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <DialogContent>
                    {editing !== null && (
                        <AccountForm
                            account={editing === 'new' ? null : editing}
                            types={types}
                            onDone={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function AccountCard({
    account,
    onEdit,
}: {
    account: Account;
    onEdit: () => void;
}) {
    const format = useFormat();
    const Icon = TYPE_ICONS[account.type] ?? Vault;
    const negative = account.balance.startsWith('-');

    return (
        <li className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{account.name}</h3>
                    <p className="text-xs text-muted-foreground">
                        {account.type_label}
                    </p>
                </div>
                {account.archived && <Badge variant="outline">Archivada</Badge>}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Acciones para ${account.name}`}
                        >
                            <MoreHorizontal aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil aria-hidden="true" />
                            Editar
                        </DropdownMenuItem>
                        {account.archived ? (
                            <DropdownMenuItem
                                onSelect={() =>
                                    postAction(
                                        AccountController.restore.url(
                                            account.id,
                                        ),
                                    )
                                }
                            >
                                <ArchiveRestore aria-hidden="true" />
                                Restaurar
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onSelect={() =>
                                    postAction(
                                        AccountController.archive.url(
                                            account.id,
                                        ),
                                    )
                                }
                            >
                                <Archive aria-hidden="true" />
                                Archivar
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div>
                <p className="text-2xl font-semibold tabular-nums">
                    {format.money(account.balance)}
                </p>
                {negative && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Info className="size-3.5" aria-hidden="true" />
                        Saldo por debajo de cero
                    </p>
                )}
            </div>

            <Link
                href={transactionsIndex({ query: { account: account.id } })}
                className="text-sm text-primary underline-offset-4 hover:underline"
            >
                {account.transactions_count === 1
                    ? 'Ver 1 movimiento'
                    : `Ver ${account.transactions_count} movimientos`}
            </Link>
        </li>
    );
}

function AccountForm({
    account,
    types,
    onDone,
}: {
    account: Account | null;
    types: Props['types'];
    onDone: () => void;
}) {
    const format = useFormat();
    const form = account
        ? AccountController.update.form(account.id)
        : AccountController.store.form();

    return (
        <Form
            {...form}
            transform={(data) => ({
                ...data,
                initial_balance: normalizeAmount(
                    typeof data.initial_balance === 'string'
                        ? data.initial_balance
                        : '',
                    format.preferences.number_locale,
                ),
            })}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-6"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>
                        {account ? `Editar «${account.name}»` : 'Nueva cuenta'}
                    </DialogTitle>
                    <DialogDescription>
                        {account
                            ? 'Cambiar el saldo inicial recalcula el saldo actual de la cuenta.'
                            : `La cuenta usará tu moneda principal (${format.preferences.currency}).`}
                    </DialogDescription>

                    <div className="grid gap-2">
                        <Label htmlFor="account-name">Nombre</Label>
                        <Input
                            id="account-name"
                            name="name"
                            defaultValue={account?.name}
                            placeholder="Ej.: Cuenta nómina"
                            required
                            autoComplete="off"
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="account-type">Tipo</Label>
                        <NativeSelect
                            id="account-type"
                            name="type"
                            defaultValue={account?.type ?? 'bank'}
                        >
                            {types.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </NativeSelect>
                        <InputError message={errors.type} />
                    </div>

                    <AmountInput
                        id="account-initial-balance"
                        name="initial_balance"
                        label={account ? 'Saldo inicial' : 'Saldo actual'}
                        defaultValue={account?.initial_balance ?? null}
                        allowNegative
                        error={errors.initial_balance}
                    />

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            {account ? 'Guardar cambios' : 'Crear cuenta'}
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

AccountsIndex.layout = {
    breadcrumbs: [{ title: 'Cuentas', href: accountsIndex() }],
};
