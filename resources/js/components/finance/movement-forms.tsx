import { Form } from '@inertiajs/react';
import { useState } from 'react';
import TransactionController from '@/actions/App/Http/Controllers/Finance/TransactionController';
import TransferController from '@/actions/App/Http/Controllers/Finance/TransferController';
import AmountInput from '@/components/finance/amount-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { useFormat } from '@/hooks/use-format';
import { normalizeAmount } from '@/lib/amount';
import type { AccountOption, CategoryOption, Movement } from '@/types/finance';

type Common = {
    accounts: AccountOption[];
    today: string;
    onDone: () => void;
};

function useAmountTransform() {
    const format = useFormat();

    return (data: Record<string, unknown>) => ({
        ...data,
        amount: normalizeAmount(
            typeof data.amount === 'string' ? data.amount : '',
            format.preferences.number_locale,
        ),
    });
}

function FormFooter({
    processing,
    label,
}: {
    processing: boolean;
    label: string;
}) {
    return (
        <DialogFooter className="gap-2">
            <DialogClose asChild>
                <Button type="button" variant="secondary">
                    Cancelar
                </Button>
            </DialogClose>
            <Button type="submit" disabled={processing}>
                {processing && <Spinner />}
                {label}
            </Button>
        </DialogFooter>
    );
}

function StatusField({
    kind,
    defaultValue,
    error,
}: {
    kind: 'income' | 'expense' | 'transfer';
    defaultValue: string;
    error?: string;
}) {
    const confirmed = {
        income: 'Cobrado',
        expense: 'Pagado',
        transfer: 'Realizada',
    }[kind];

    return (
        <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Estado</legend>
            <div className="grid grid-cols-2 gap-2">
                {[
                    ['confirmed', confirmed, 'Cuenta en el saldo actual'],
                    ['planned', 'Previsto', 'Aún no ha ocurrido'],
                ].map(([value, label, hint]) => (
                    <label
                        key={value}
                        className="flex cursor-pointer flex-col rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
                    >
                        <span className="flex items-center gap-2 font-medium">
                            <input
                                type="radio"
                                name="status"
                                value={value}
                                defaultChecked={defaultValue === value}
                                className="accent-primary"
                            />
                            {label}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                            {hint}
                        </span>
                    </label>
                ))}
            </div>
            <InputError message={error} />
        </fieldset>
    );
}

export function TransactionForm({
    kind,
    movement,
    accounts,
    categories,
    today,
    onDone,
}: Common & {
    kind: 'income' | 'expense';
    movement: Movement | null;
    categories: CategoryOption[];
}) {
    // Identificador estable del alta: si se reenvía, el servidor no duplica.
    const [uuid] = useState(() => crypto.randomUUID());
    const transform = useAmountTransform();
    const isExpense = kind === 'expense';
    const form = movement
        ? TransactionController.update.form(movement.id)
        : TransactionController.store.form();

    // Se ofrecen las activas, más la ya elegida aunque esté archivada.
    const accountOptions = accounts.filter(
        (account) => !account.archived || account.id === movement?.account.id,
    );
    const categoryOptions = categories.filter(
        (category) =>
            category.kind === kind &&
            (!category.archived || category.id === movement?.category?.id),
    );

    const title = movement
        ? `Editar ${isExpense ? 'gasto' : 'ingreso'}`
        : isExpense
          ? 'Nuevo gasto'
          : 'Nuevo ingreso';

    if (accountOptions.length === 0) {
        return <NeedsAccount title={title} />;
    }

    return (
        <Form
            {...form}
            transform={transform}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-5"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {isExpense
                            ? 'Registra un pago o un gasto previsto.'
                            : 'Registra un cobro o un ingreso previsto.'}
                    </DialogDescription>

                    {!movement && (
                        <>
                            <input type="hidden" name="kind" value={kind} />
                            <input type="hidden" name="uuid" value={uuid} />
                        </>
                    )}

                    <AmountInput
                        id="movement-amount"
                        name="amount"
                        label="Importe"
                        defaultValue={movement?.amount ?? null}
                        error={errors.amount}
                    />

                    <div className="grid gap-2">
                        <Label htmlFor="movement-concept">Concepto</Label>
                        <Input
                            id="movement-concept"
                            name="concept"
                            defaultValue={movement?.concept}
                            placeholder={
                                isExpense ? 'Ej.: Supermercado' : 'Ej.: Nómina'
                            }
                            maxLength={255}
                            required
                            autoComplete="off"
                        />
                        <InputError message={errors.concept} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="movement-category">Categoría</Label>
                            <NativeSelect
                                id="movement-category"
                                name="category_id"
                                defaultValue={
                                    movement?.category?.id ??
                                    categoryOptions[0]?.id
                                }
                                required
                            >
                                {categoryOptions.map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.category_id} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="movement-account">
                                {isExpense ? 'Pagado desde' : 'Cobrado en'}
                            </Label>
                            <NativeSelect
                                id="movement-account"
                                name="account_id"
                                defaultValue={
                                    movement?.account.id ?? accountOptions[0].id
                                }
                                required
                            >
                                {accountOptions.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.account_id} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="movement-date">Fecha</Label>
                            <Input
                                id="movement-date"
                                name="occurred_on"
                                type="date"
                                defaultValue={movement?.occurred_on ?? today}
                                required
                            />
                            <InputError message={errors.occurred_on} />
                        </div>

                        {isExpense && (
                            <div className="grid gap-2">
                                <Label htmlFor="movement-nature">
                                    Tipo de gasto
                                </Label>
                                <NativeSelect
                                    id="movement-nature"
                                    name="nature"
                                    defaultValue={movement?.nature ?? ''}
                                >
                                    <option value="">Sin indicar</option>
                                    <option value="fixed">Fijo</option>
                                    <option value="variable">Variable</option>
                                </NativeSelect>
                                <InputError message={errors.nature} />
                            </div>
                        )}
                    </div>

                    <StatusField
                        kind={kind}
                        defaultValue={movement?.status ?? 'confirmed'}
                        error={errors.status}
                    />

                    {isExpense && (
                        <div className="grid gap-2">
                            <Label htmlFor="movement-due">
                                Vencimiento{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="movement-due"
                                name="due_on"
                                type="date"
                                defaultValue={movement?.due_on ?? ''}
                            />
                            <InputError message={errors.due_on} />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="movement-notes">
                            Notas{' '}
                            <span className="font-normal text-muted-foreground">
                                (opcional)
                            </span>
                        </Label>
                        <textarea
                            id="movement-notes"
                            name="notes"
                            defaultValue={movement?.notes ?? ''}
                            rows={2}
                            maxLength={2000}
                            className="rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                        />
                        <InputError message={errors.notes} />
                    </div>

                    <InputError message={errors.transaction ?? errors.kind} />

                    <FormFooter
                        processing={processing}
                        label={movement ? 'Guardar cambios' : 'Registrar'}
                    />
                </>
            )}
        </Form>
    );
}

export function TransferForm({
    movement,
    accounts,
    today,
    onDone,
}: Common & { movement: Movement | null }) {
    const transform = useAmountTransform();
    const transfer = movement?.transfer ?? null;
    const form = transfer
        ? TransferController.update.form(transfer.id)
        : TransferController.store.form();

    const options = accounts.filter(
        (account) =>
            !account.archived ||
            account.id === transfer?.from.id ||
            account.id === transfer?.to.id,
    );
    const title = transfer ? 'Editar transferencia' : 'Nueva transferencia';

    if (options.length < 2) {
        return (
            <NeedsAccount
                title={title}
                text="Para transferir dinero necesitas al menos dos cuentas activas."
            />
        );
    }

    return (
        <Form
            {...form}
            transform={transform}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-5"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Mueve dinero entre tus cuentas. No cuenta como ingreso
                        ni como gasto.
                    </DialogDescription>

                    <AmountInput
                        id="transfer-amount"
                        name="amount"
                        label="Importe"
                        defaultValue={movement?.amount ?? null}
                        error={errors.amount}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="transfer-from">Desde</Label>
                            <NativeSelect
                                id="transfer-from"
                                name="from_account_id"
                                defaultValue={
                                    transfer?.from.id ?? options[0].id
                                }
                            >
                                {options.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.from_account_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="transfer-to">Hacia</Label>
                            <NativeSelect
                                id="transfer-to"
                                name="to_account_id"
                                defaultValue={transfer?.to.id ?? options[1].id}
                            >
                                {options.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <InputError message={errors.to_account_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="transfer-date">Fecha</Label>
                            <Input
                                id="transfer-date"
                                name="occurred_on"
                                type="date"
                                defaultValue={movement?.occurred_on ?? today}
                                required
                            />
                            <InputError message={errors.occurred_on} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="transfer-concept">
                                Concepto{' '}
                                <span className="font-normal text-muted-foreground">
                                    (opcional)
                                </span>
                            </Label>
                            <Input
                                id="transfer-concept"
                                name="concept"
                                defaultValue={transfer?.concept ?? ''}
                                maxLength={255}
                                autoComplete="off"
                            />
                            <InputError message={errors.concept} />
                        </div>
                    </div>

                    <StatusField
                        kind="transfer"
                        defaultValue={movement?.status ?? 'confirmed'}
                        error={errors.status}
                    />

                    <input
                        type="hidden"
                        name="notes"
                        value={transfer?.notes ?? ''}
                    />

                    <InputError message={errors.transfer} />

                    <FormFooter
                        processing={processing}
                        label={transfer ? 'Guardar cambios' : 'Transferir'}
                    />
                </>
            )}
        </Form>
    );
}

export function VoidForm({
    movement,
    onDone,
}: {
    movement: Movement;
    onDone: () => void;
}) {
    const form = movement.transfer
        ? TransferController.void.form(movement.transfer.id)
        : TransactionController.void.form(movement.id);

    return (
        <Form
            {...form}
            options={{ preserveScroll: true }}
            onSuccess={onDone}
            className="space-y-5"
        >
            {({ errors, processing }) => (
                <>
                    <DialogTitle>
                        ¿Anular «
                        {movement.transfer?.concept ?? movement.concept}»?
                    </DialogTitle>
                    <DialogDescription>
                        {movement.transfer
                            ? 'Se anulará en las dos cuentas. Quedará en el historial, pero dejará de contar en los saldos.'
                            : 'Quedará en el historial, pero dejará de contar en los saldos y totales.'}
                    </DialogDescription>

                    <div className="grid gap-2">
                        <Label htmlFor="void-reason">Motivo</Label>
                        <Input
                            id="void-reason"
                            name="reason"
                            placeholder="Ej.: Cargo duplicado"
                            maxLength={255}
                            required
                            autoFocus
                        />
                        <InputError
                            message={
                                errors.reason ??
                                errors.transaction ??
                                errors.transfer
                            }
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing}
                        >
                            {processing && <Spinner />}
                            Anular
                        </Button>
                    </DialogFooter>
                </>
            )}
        </Form>
    );
}

function NeedsAccount({ title, text }: { title: string; text?: string }) {
    return (
        <>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
                {text ??
                    'Antes de registrar movimientos, crea al menos una cuenta en el apartado Cuentas.'}
            </DialogDescription>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="secondary">Entendido</Button>
                </DialogClose>
            </DialogFooter>
        </>
    );
}
