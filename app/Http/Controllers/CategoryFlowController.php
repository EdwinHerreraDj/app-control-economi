<?php

namespace App\Http\Controllers;

use App\Enums\CategoryKind;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Apartados «Gastos» e «Ingresos»: lo del mes agrupado por categoría.
 *
 * Se muestran siempre las categorías de la persona (con su icono), aunque
 * todavía no tengan movimientos: desde ellas se apunta con un toque.
 */
class CategoryFlowController extends Controller
{
    public function expenses(Request $request): Response
    {
        return $this->render($request, TransactionKind::Expense);
    }

    public function incomes(Request $request): Response
    {
        return $this->render($request, TransactionKind::Income);
    }

    private function render(Request $request, TransactionKind $kind): Response
    {
        /** @var User $user */
        $user = $request->user();
        $current = $user->today()->startOfMonth();
        $requested = (string) $request->query('month', '');
        $month = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $requested)
            ? CarbonImmutable::createFromFormat('!Y-m', $requested, $user->timezone)
            : $current;

        if ($month->greaterThan($current)) {
            $month = $current;
        }

        $from = $month->startOfMonth()->toDateString();
        $until = $month->endOfMonth()->addDay()->toDateString();
        $currency = (string) $user->currency;

        $movements = Transaction::query()->ownedBy($user)
            ->where('kind', $kind->value)
            ->whereNull('voided_at')
            // Hasta el día siguiente sin incluirlo: cuenta todo el último día.
            ->where('occurred_on', '>=', $from)
            ->where('occurred_on', '<', $until)
            ->with('account:id,name')
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->get();

        $categoryKind = $kind === TransactionKind::Income ? CategoryKind::Income : CategoryKind::Expense;
        $usedIds = $movements->pluck('category_id')->filter()->unique();

        // Las activas y las archivadas que tengan algo este mes.
        $categories = Category::query()->ownedBy($user)
            ->where('kind', $categoryKind->value)
            ->where(fn ($query) => $query->whereNull('archived_at')->orWhereIn('id', $usedIds))
            ->orderBy('name')
            ->get();

        $present = fn (Transaction $t) => [
            'id' => $t->id,
            'kind' => $t->kind->value,
            'status' => $t->status->value,
            'concept' => $t->concept,
            'amount' => Money::toDecimal($t->amount, $t->currency),
            'currency' => $t->currency,
            'occurred_on' => $t->occurred_on->toDateString(),
            'due_on' => $t->due_on?->toDateString(),
            'nature' => $t->nature?->value,
            'spending_type' => $t->spending_type?->value,
            'notes' => $t->notes,
            'voided' => false,
            'void_reason' => null,
            'debt_managed' => $t->debt_id !== null,
            'recurring' => $t->recurring_rule_id !== null,
            'account' => ['id' => $t->account->id, 'name' => $t->account->name],
            'category' => null,
            'transfer' => null,
        ];

        /** @var Collection<int, Collection<int, Transaction>> $byCategory */
        $byCategory = $movements->groupBy('category_id');
        $sum = fn (Collection $items, TransactionStatus $status) => (int) $items
            ->filter(fn (Transaction $t) => $t->status === $status)->sum('amount');

        $groups = $categories->map(function (Category $category) use ($byCategory, $sum, $present, $currency) {
            $items = $byCategory->get($category->id, collect());

            return [
                'id' => $category->id,
                'name' => $category->name,
                'icon' => $category->icon,
                'color' => $category->color,
                'archived' => $category->isArchived(),
                'total' => Money::toDecimal($sum($items, TransactionStatus::Confirmed), $currency),
                'pending' => Money::toDecimal($sum($items, TransactionStatus::Planned), $currency),
                'count' => $items->count(),
                'movements' => $items->map(fn (Transaction $t) => [
                    ...$present($t),
                    'category' => ['id' => $category->id, 'name' => $category->name, 'icon' => $category->icon, 'color' => $category->color],
                ])->values(),
            ];
        })
            // Primero donde más dinero se ha movido; las vacías, al final.
            ->sortBy([
                fn (array $a, array $b) => ($b['count'] > 0) <=> ($a['count'] > 0),
                fn (array $a, array $b) => Money::toMinor($b['total'], $currency) <=> Money::toMinor($a['total'], $currency),
                fn (array $a, array $b) => strcmp($a['name'], $b['name']),
            ])
            ->values();

        return Inertia::render('flows/index', [
            'kind' => $kind->value,
            'month' => $month->format('Y-m'),
            'previous' => $month->subMonthNoOverflow()->format('Y-m'),
            'next' => $month->lessThan($current) ? $month->addMonthNoOverflow()->format('Y-m') : null,
            'isCurrent' => $month->equalTo($current),
            'total' => Money::toDecimal($sum($movements, TransactionStatus::Confirmed), $currency),
            'pending' => Money::toDecimal($sum($movements, TransactionStatus::Planned), $currency),
            'groups' => $groups,
            'accounts' => Account::query()->ownedBy($user)->orderBy('name')->get(['id', 'name', 'archived_at', 'type'])
                ->map(fn (Account $a) => ['id' => $a->id, 'name' => $a->name, 'archived' => $a->isArchived()]),
            'categories' => Category::query()->ownedBy($user)->orderBy('name')->get(['id', 'kind', 'name', 'icon', 'color', 'archived_at'])
                ->map(fn (Category $c) => [
                    'id' => $c->id, 'kind' => $c->kind->value, 'name' => $c->name,
                    'icon' => $c->icon, 'color' => $c->color, 'archived' => $c->isArchived(),
                ]),
            'today' => $user->today()->toDateString(),
        ]);
    }
}
