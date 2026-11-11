<?php

namespace App\Http\Controllers\Finance;

use App\Actions\Finance\ManageAccounts;
use App\Enums\AccountType;
use App\Finance\AccountBalances;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\AccountRequest;
use App\Models\Account;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function index(Request $request, AccountBalances $balances): Response
    {
        /** @var User $user */
        $user = $request->user();
        $balanceById = $balances->forUser($user);

        $accounts = Account::query()
            ->ownedBy($user)
            ->withCount('transactions')
            ->orderByRaw('archived_at IS NOT NULL')
            ->orderBy('name')
            ->get()
            ->map(fn (Account $account) => [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type->value,
                'type_label' => $account->type->label(),
                'currency' => $account->currency,
                'initial_balance' => Money::toDecimal($account->initial_balance, $account->currency),
                'balance' => Money::toDecimal($balanceById[$account->id] ?? 0, $account->currency),
                'archived' => $account->isArchived(),
                'transactions_count' => $account->transactions_count,
            ]);

        $activeTotal = $accounts->where('archived', false)
            ->sum(fn (array $account) => $balanceById[$account['id']] ?? 0);

        return Inertia::render('finance/accounts/index', [
            'accounts' => $accounts,
            'total' => Money::toDecimal($activeTotal, (string) $user->currency),
            'types' => collect(AccountType::cases())->map(fn (AccountType $type) => [
                'value' => $type->value,
                'label' => $type->label(),
            ]),
        ]);
    }

    public function store(AccountRequest $request, ManageAccounts $accounts): RedirectResponse
    {
        $accounts->create(
            $request->user(),
            $request->validated('name'),
            AccountType::from($request->validated('type')),
            $request->initialBalance(),
        );

        $this->toast('Cuenta creada.');

        return back();
    }

    public function update(AccountRequest $request, Account $account, ManageAccounts $accounts): RedirectResponse
    {
        Gate::authorize('update', $account);

        $accounts->update(
            $account,
            $request->validated('name'),
            AccountType::from($request->validated('type')),
            $request->initialBalance(),
        );

        $this->toast('Cuenta actualizada.');

        return back();
    }

    public function archive(Account $account, ManageAccounts $accounts): RedirectResponse
    {
        Gate::authorize('update', $account);

        $accounts->archive($account);
        $this->toast("«{$account->name}» se ha archivado. Su historial se conserva.");

        return back();
    }

    public function restore(Account $account, ManageAccounts $accounts): RedirectResponse
    {
        Gate::authorize('update', $account);

        $accounts->restore($account);
        $this->toast("«{$account->name}» vuelve a estar activa.");

        return back();
    }
}
