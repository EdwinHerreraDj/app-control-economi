<?php

namespace App\Http\Controllers\Finance;

use App\Actions\Finance\ManageRecurringRules;
use App\Actions\Finance\RecordTransaction;
use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\TransactionRequest;
use App\Http\Requests\Finance\VoidRequest;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $filters = $this->filters($request, $user);
        [$from, $to] = $this->monthRange($filters['month']);

        $query = Transaction::query()
            ->ownedBy($user)
            ->whereBetween('occurred_on', [$from, $to])
            ->with(['account:id,name', 'category:id,name,icon,color', 'transfer.fromAccount:id,name', 'transfer.toAccount:id,name']);

        $this->applyFilters($query, $filters);

        $transactions = $query
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->paginate(50)
            ->withQueryString()
            ->through(fn (Transaction $transaction) => $this->present($transaction));

        return Inertia::render('finance/transactions/index', [
            'transactions' => $transactions,
            'filters' => $filters,
            'summary' => $this->summary($user, $from, $to),
            'accounts' => Account::query()->ownedBy($user)->orderBy('name')
                ->get(['id', 'name', 'archived_at'])
                ->map(fn (Account $account) => ['id' => $account->id, 'name' => $account->name, 'archived' => $account->isArchived()]),
            'categories' => Category::query()->ownedBy($user)->orderBy('name')
                ->get(['id', 'kind', 'name', 'icon', 'color', 'archived_at'])
                ->map(fn (Category $category) => [
                    'id' => $category->id,
                    'kind' => $category->kind->value,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'color' => $category->color,
                    'archived' => $category->isArchived(),
                ]),
            'today' => CarbonImmutable::now($user->timezone)->toDateString(),
        ]);
    }

    public function store(TransactionRequest $request, RecordTransaction $record, ManageRecurringRules $rules): RedirectResponse
    {
        /** @var array{kind: TransactionKind, account: Account, category: Category, amount: int, occurred_on: string, status: TransactionStatus, concept: string, notes: string|null, nature: ExpenseNature|null, due_on: string|null, uuid: string|null, repeat: Frequency|null} $payload */
        $payload = $request->payload();
        /** @var User $user */
        $user = $request->user();
        $isIncome = $payload['kind'] === TransactionKind::Income;

        $transaction = DB::transaction(function () use ($user, $payload, $record, $rules) {
            $transaction = $record->create($user, $payload);

            // «Se repite»: este movimiento es la primera vez y las siguientes
            // quedan pendientes en Recurrentes. Reenviar el mismo formulario
            // (mismo uuid) no crea otra recurrencia.
            if ($payload['repeat'] !== null && $transaction->wasRecentlyCreated) {
                $rule = $rules->create($user, [
                    'kind' => $payload['kind'],
                    'account' => $payload['account'],
                    'category' => $payload['category'],
                    'amount' => $payload['amount'],
                    'concept' => $payload['concept'],
                    'nature' => $payload['nature'] ?? ExpenseNature::Fixed,
                    'frequency' => $payload['repeat'],
                    'starts_on' => $payload['occurred_on'],
                    'ends_on' => null,
                    'generate_from' => CarbonImmutable::parse($payload['occurred_on'])->addDay()->toDateString(),
                ]);

                $transaction->forceFill([
                    'recurring_rule_id' => $rule->id,
                    'occurrence_on' => $payload['occurred_on'],
                ])->save();
            }

            return $transaction;
        });

        $this->toast(match (true) {
            $transaction->recurring_rule_id !== null && $payload['repeat'] !== null => ($isIncome ? 'Ingreso registrado' : 'Gasto registrado')
                .'. Se repetirá '.mb_strtolower($payload['repeat']->label()).': lo verás en Recurrentes.',
            $isIncome => 'Ingreso registrado.',
            default => 'Gasto registrado.',
        });

        return back();
    }

    public function update(TransactionRequest $request, Transaction $transaction, RecordTransaction $record): RedirectResponse
    {
        Gate::authorize('update', $transaction);

        /** @var array{account: Account, category: Category, amount: int, occurred_on: string, status: TransactionStatus, concept: string, notes: string|null, nature: ExpenseNature|null, due_on: string|null} $payload */
        $payload = $request->payload();
        $record->update($transaction, $payload);
        $this->toast('Movimiento actualizado.');

        return back();
    }

    public function confirm(Transaction $transaction, RecordTransaction $record): RedirectResponse
    {
        Gate::authorize('update', $transaction);

        $record->confirm($transaction);
        $this->toast($transaction->kind === TransactionKind::Income ? 'Marcado como cobrado.' : 'Marcado como pagado.');

        return back();
    }

    public function void(VoidRequest $request, Transaction $transaction, RecordTransaction $record): RedirectResponse
    {
        Gate::authorize('update', $transaction);

        $record->void($transaction, $request->validated('reason'));
        $this->toast('Movimiento anulado. Queda en el historial, pero ya no cuenta en los saldos.');

        return back();
    }

    /**
     * @return array{month: string, kind: string|null, status: string|null, account: int|null, category: int|null, search: string}
     */
    private function filters(Request $request, User $user): array
    {
        $month = (string) $request->query('month', '');

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            $month = CarbonImmutable::now($user->timezone)->format('Y-m');
        }

        $pick = fn (string $key, array $allowed) => in_array($request->query($key), $allowed, true) ? (string) $request->query($key) : null;

        return [
            'month' => $month,
            'kind' => $pick('kind', ['income', 'expense', 'transfer']),
            'status' => $pick('status', ['planned', 'confirmed', 'voided']),
            'account' => $request->integer('account') ?: null,
            'category' => $request->integer('category') ?: null,
            'search' => mb_substr(trim((string) $request->query('search', '')), 0, 100),
        ];
    }

    /**
     * @param  Builder<Transaction>  $query
     * @param  array{month: string, kind: string|null, status: string|null, account: int|null, category: int|null, search: string}  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        // Sin filtro de cuenta, cada transferencia aparece una sola vez (su salida).
        if ($filters['account'] !== null) {
            $query->where('account_id', $filters['account']);
        } else {
            $query->where('kind', '!=', TransactionKind::TransferIn->value);
        }

        match ($filters['kind']) {
            'income' => $query->where('kind', TransactionKind::Income->value),
            'expense' => $query->where('kind', TransactionKind::Expense->value),
            'transfer' => $query->whereIn('kind', [TransactionKind::TransferIn->value, TransactionKind::TransferOut->value]),
            default => null,
        };

        match ($filters['status']) {
            'planned' => $query->where('status', TransactionStatus::Planned->value)->whereNull('voided_at'),
            'confirmed' => $query->where('status', TransactionStatus::Confirmed->value)->whereNull('voided_at'),
            'voided' => $query->whereNotNull('voided_at'),
            default => null,
        };

        if ($filters['category'] !== null) {
            $query->where('category_id', $filters['category']);
        }

        if ($filters['search'] !== '') {
            $query->where(fn (Builder $query) => $query
                ->where('concept', 'like', '%'.$filters['search'].'%')
                ->orWhere('notes', 'like', '%'.$filters['search'].'%'));
        }
    }

    /**
     * Totales del mes. Las transferencias no son ingresos ni gastos y los
     * movimientos anulados no cuentan.
     *
     * @return array{income: string, expense: string, net: string, planned_income: string, planned_expense: string}
     */
    private function summary(User $user, string $from, string $to): array
    {
        $rows = Transaction::query()
            ->ownedBy($user)
            ->whereBetween('occurred_on', [$from, $to])
            ->whereNull('voided_at')
            ->whereIn('kind', [TransactionKind::Income->value, TransactionKind::Expense->value])
            ->groupBy('kind', 'status')
            ->selectRaw('kind, status, SUM(amount) AS total')
            ->toBase()
            ->get();

        $total = fn (TransactionKind $kind, TransactionStatus $status) => (int) ($rows
            ->first(fn (object $row) => $row->kind === $kind->value && $row->status === $status->value)
            ->total ?? 0);

        $currency = (string) $user->currency;
        $income = $total(TransactionKind::Income, TransactionStatus::Confirmed);
        $expense = $total(TransactionKind::Expense, TransactionStatus::Confirmed);

        return [
            'income' => Money::toDecimal($income, $currency),
            'expense' => Money::toDecimal($expense, $currency),
            // Diferencia entre lo cobrado y lo pagado en el mes (no es el saldo).
            'net' => Money::toDecimal($income - $expense, $currency),
            'planned_income' => Money::toDecimal($total(TransactionKind::Income, TransactionStatus::Planned), $currency),
            'planned_expense' => Money::toDecimal($total(TransactionKind::Expense, TransactionStatus::Planned), $currency),
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function monthRange(string $month): array
    {
        $start = CarbonImmutable::createFromFormat('!Y-m', $month);

        return [$start->toDateString(), $start->endOfMonth()->toDateString()];
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Transaction $transaction): array
    {
        $transfer = $transaction->transfer;

        return [
            'id' => $transaction->id,
            'kind' => $transaction->kind->value,
            'status' => $transaction->status->value,
            'amount' => Money::toDecimal($transaction->amount, $transaction->currency),
            'currency' => $transaction->currency,
            'occurred_on' => $transaction->occurred_on->toDateString(),
            'due_on' => $transaction->due_on?->toDateString(),
            'nature' => $transaction->nature?->value,
            'concept' => $transaction->concept,
            'notes' => $transaction->notes,
            'voided' => $transaction->isVoided(),
            // Movimientos de deudas: se gestionan desde el apartado Deudas.
            'debt_managed' => $transaction->debt_id !== null,
            'void_reason' => $transaction->void_reason,
            'account' => ['id' => $transaction->account->id, 'name' => $transaction->account->name],
            'category' => $transaction->category ? [
                'id' => $transaction->category->id,
                'name' => $transaction->category->name,
                'icon' => $transaction->category->icon,
                'color' => $transaction->category->color,
            ] : null,
            'transfer' => $transfer ? [
                'id' => $transfer->id,
                'from' => ['id' => $transfer->fromAccount->id, 'name' => $transfer->fromAccount->name],
                'to' => ['id' => $transfer->toAccount->id, 'name' => $transfer->toAccount->name],
                'concept' => $transfer->concept,
                'notes' => $transfer->notes,
            ] : null,
        ];
    }
}
