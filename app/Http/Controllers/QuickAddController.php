<?php

namespace App\Http\Controllers;

use App\Enums\AccountType;
use App\Enums\CategoryKind;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Finance\AccountBalances;
use App\Finance\CategoryGuesser;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Datos para los formularios rápidos («Gasté dinero», «Me entró dinero»,
 * «Guardar en mis ahorros»). Se piden al abrirlos, no en cada página.
 */
class QuickAddController extends Controller
{
    public function __invoke(Request $request, CategoryGuesser $guesser, AccountBalances $balances): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $today = $user->today();
        $amounts = $balances->forUser($user);

        // Cobros y pagos pendientes cercanos: si lo que se apunta es uno de
        // ellos, se confirma ese en lugar de crear otro (no se duplica).
        $pending = Transaction::query()->ownedBy($user)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->whereIn('kind', [TransactionKind::Income->value, TransactionKind::Expense->value])
            ->where('occurred_on', '>=', $today->subDays(20)->toDateString())->where('occurred_on', '<', $today->addDays(11)->toDateString())
            ->orderBy('occurred_on')
            ->get()
            ->map(fn (Transaction $t) => [
                'id' => $t->id,
                'kind' => $t->kind->value,
                'concept' => $t->concept,
                'amount' => Money::toDecimal($t->amount, $t->currency),
                'date' => $t->occurred_on->toDateString(),
                'category_id' => $t->category_id,
                'account_id' => $t->account_id,
            ]);

        return response()->json([
            'today' => $today->toDateString(),
            'accounts' => Account::query()->ownedBy($user)->active()->orderByRaw("type = 'savings'")->orderBy('id')->get()
                ->map(fn (Account $a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'type' => $a->type->value,
                    'savings' => $a->type === AccountType::Savings,
                    'balance' => Money::toDecimal($amounts[$a->id] ?? 0, $a->currency),
                ]),
            'categories' => Category::query()->ownedBy($user)->active()->orderBy('name')->get()
                ->map(fn (Category $c) => ['id' => $c->id, 'kind' => $c->kind->value, 'name' => $c->name, 'icon' => $c->icon, 'color' => $c->color]),
            'keywords' => [
                'expense' => $guesser->keywords($user, CategoryKind::Expense),
                'income' => $guesser->keywords($user, CategoryKind::Income),
            ],
            'history' => [
                'expense' => $guesser->history($user, CategoryKind::Expense),
                'income' => $guesser->history($user, CategoryKind::Income),
            ],
            'fallback' => [
                'expense' => $guesser->fallback($user, CategoryKind::Expense)?->id,
                'income' => $guesser->fallback($user, CategoryKind::Income)?->id,
            ],
            'pending' => $pending,
        ])->header('Cache-Control', 'no-store, private');
    }
}
