<?php

namespace App\Finance;

use App\Enums\TransactionKind;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Comprobaciones de integridad de los datos financieros.
 *
 * Verifica los invariantes de los que dependen saldos y estadísticas. Solo
 * devuelve identificadores: nunca importes, conceptos ni nombres, para que
 * el informe pueda guardarse en los registros sin exponer datos personales.
 */
class IntegrityChecker
{
    /**
     * @return array<string, array{label: string, ids: list<int>}>
     */
    public function run(): array
    {
        $checks = [
            'transaction_owner' => ['Movimientos cuya cuenta es de otro usuario', $this->transactionOwner()],
            'transaction_currency' => ['Movimientos con moneda distinta a la de su cuenta', $this->transactionCurrency()],
            'transaction_category' => ['Movimientos con categoría ajena o de otro tipo', $this->transactionCategory()],
            'transfer_legs' => ['Transferencias sin sus dos movimientos coherentes', $this->transferLegs()],
            'orphan_transfer_legs' => ['Movimientos de transferencia sin transferencia', $this->orphanTransferLegs()],
            'debt_payments' => ['Pagos de deuda que no cuadran con sus movimientos', $this->debtPayments()],
            'contributions_owner' => ['Aportaciones a objetivos de otro usuario', $this->contributionsOwner()],
            'recurring_owner' => ['Recurrencias con cuenta o categoría ajena', $this->recurringOwner()],
        ];

        return array_map(
            fn (array $check) => ['label' => $check[0], 'ids' => $check[1]],
            $checks,
        );
    }

    /**
     * @return list<int>
     */
    private function ids(Builder $query, string $column = 't.id'): array
    {
        return array_values(array_map('intval', $query->distinct()->orderBy($column)->limit(1000)->pluck($column)->all()));
    }

    /**
     * @return list<int>
     */
    private function transactionOwner(): array
    {
        return $this->ids(DB::table('transactions as t')
            ->join('accounts as a', 'a.id', '=', 't.account_id')
            ->whereColumn('a.user_id', '!=', 't.user_id'));
    }

    /**
     * @return list<int>
     */
    private function transactionCurrency(): array
    {
        return $this->ids(DB::table('transactions as t')
            ->join('accounts as a', 'a.id', '=', 't.account_id')
            ->whereColumn('a.currency', '!=', 't.currency'));
    }

    /**
     * @return list<int>
     */
    private function transactionCategory(): array
    {
        return $this->ids(DB::table('transactions as t')
            ->join('categories as c', 'c.id', '=', 't.category_id')
            ->where(fn (Builder $query) => $query
                ->whereColumn('c.user_id', '!=', 't.user_id')
                ->orWhere(fn (Builder $query) => $query
                    ->where('t.kind', TransactionKind::Income->value)
                    ->where('c.kind', '!=', 'income'))
                ->orWhere(fn (Builder $query) => $query
                    ->where('t.kind', TransactionKind::Expense->value)
                    ->where('c.kind', '!=', 'expense'))));
    }

    /**
     * Cada transferencia: una salida desde la cuenta de origen y una entrada
     * en la de destino, del mismo importe, estado y anulación.
     *
     * @return list<int>
     */
    private function transferLegs(): array
    {
        $leg = fn (string $alias, TransactionKind $kind, string $accountColumn) => fn ($join) => $join
            ->on("{$alias}.transfer_id", '=', 'tr.id')
            ->where("{$alias}.kind", $kind->value)
            ->whereColumn("{$alias}.account_id", "tr.{$accountColumn}")
            ->whereColumn("{$alias}.amount", 'tr.amount')
            ->whereColumn("{$alias}.status", 'tr.status')
            ->whereColumn("{$alias}.user_id", 'tr.user_id');

        $incoherent = DB::table('transfers as tr')
            ->leftJoin('transactions as o', $leg('o', TransactionKind::TransferOut, 'from_account_id'))
            ->leftJoin('transactions as i', $leg('i', TransactionKind::TransferIn, 'to_account_id'))
            ->where(fn (Builder $query) => $query
                ->whereNull('o.id')
                ->orWhereNull('i.id')
                ->orWhereRaw('(o.voided_at IS NULL) <> (tr.voided_at IS NULL)')
                ->orWhereRaw('(i.voided_at IS NULL) <> (tr.voided_at IS NULL)'));

        $extraLegs = DB::table('transfers as tr')
            ->join('transactions as t', 't.transfer_id', '=', 'tr.id')
            ->groupBy('tr.id')
            ->havingRaw('COUNT(*) <> 2')
            ->select('tr.id');

        return array_values(array_unique([
            ...$this->ids($incoherent, 'tr.id'),
            ...array_map('intval', $extraLegs->pluck('tr.id')->all()),
        ]));
    }

    /**
     * @return list<int>
     */
    private function orphanTransferLegs(): array
    {
        return $this->ids(DB::table('transactions as t')
            ->whereIn('t.kind', [TransactionKind::TransferIn->value, TransactionKind::TransferOut->value])
            ->whereNull('t.transfer_id'));
    }

    /**
     * Un pago vigente suma capital + intereses + comisiones en movimientos
     * vigentes; uno anulado no deja movimientos vigentes.
     *
     * @return list<int>
     */
    private function debtPayments(): array
    {
        $totals = DB::table('debt_payments as p')
            ->leftJoin('transactions as t', fn ($join) => $join
                ->on('t.debt_payment_id', '=', 'p.id')
                ->whereNull('t.voided_at'))
            ->groupBy('p.id', 'p.voided_at', 'p.principal_amount', 'p.interest_amount', 'p.fees_amount', 'p.user_id', 'p.account_id')
            ->selectRaw('p.id, p.voided_at, p.principal_amount + p.interest_amount + p.fees_amount AS expected, COALESCE(SUM(t.amount), 0) AS recorded, SUM(CASE WHEN t.user_id <> p.user_id OR t.account_id <> p.account_id THEN 1 ELSE 0 END) AS mismatched')
            ->get();

        return array_values($totals
            ->filter(fn (object $row) => (int) $row->mismatched > 0
                || ($row->voided_at === null ? (int) $row->recorded !== (int) $row->expected : (int) $row->recorded !== 0))
            ->map(fn (object $row) => (int) $row->id)
            ->all());
    }

    /**
     * @return list<int>
     */
    private function contributionsOwner(): array
    {
        return $this->ids(DB::table('savings_contributions as s')
            ->join('savings_goals as g', 'g.id', '=', 's.savings_goal_id')
            ->whereColumn('g.user_id', '!=', 's.user_id'), 's.id');
    }

    /**
     * @return list<int>
     */
    private function recurringOwner(): array
    {
        return $this->ids(DB::table('recurring_rules as r')
            ->join('accounts as a', 'a.id', '=', 'r.account_id')
            ->join('categories as c', 'c.id', '=', 'r.category_id')
            ->where(fn (Builder $query) => $query
                ->whereColumn('a.user_id', '!=', 'r.user_id')
                ->orWhereColumn('c.user_id', '!=', 'r.user_id')), 'r.id');
    }
}
