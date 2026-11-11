export type MovementKind =
    | 'income'
    | 'expense'
    | 'transfer_in'
    | 'transfer_out'
    | 'debt_in'
    | 'debt_out';

export type Movement = {
    id: number;
    kind: MovementKind;
    status: 'planned' | 'confirmed';
    amount: string;
    currency: string;
    occurred_on: string;
    due_on: string | null;
    nature: 'fixed' | 'variable' | null;
    concept: string;
    notes: string | null;
    voided: boolean;
    /** Movimiento de una deuda: se gestiona desde el apartado Deudas. */
    debt_managed: boolean;
    void_reason: string | null;
    account: { id: number; name: string };
    category: { id: number; name: string; icon: string; color: string } | null;
    transfer: {
        id: number;
        from: { id: number; name: string };
        to: { id: number; name: string };
        concept: string | null;
        notes: string | null;
    } | null;
};

export type AccountOption = { id: number; name: string; archived: boolean };

export type CategoryOption = {
    id: number;
    kind: 'income' | 'expense';
    name: string;
    icon: string;
    color: string;
    archived: boolean;
};

export type Filters = {
    month: string;
    kind: 'income' | 'expense' | 'transfer' | null;
    status: 'planned' | 'confirmed' | 'voided' | null;
    account: number | null;
    category: number | null;
    search: string;
};

export type Summary = {
    income: string;
    expense: string;
    net: string;
    planned_income: string;
    planned_expense: string;
};

export type FormMode =
    | { type: 'income' | 'expense'; movement: Movement | null }
    | { type: 'transfer'; movement: Movement | null };
