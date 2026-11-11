<?php

namespace App\Finance;

use App\Enums\CategoryKind;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Budget;
use App\Models\Category;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Comparación mensual entre lo presupuestado, lo realizado (gastos
 * confirmados) y lo previsto (gastos pendientes) por categoría.
 *
 * Todo se calcula en el servidor con enteros; el porcentaje es orientativo.
 */
class BudgetReport
{
    /**
     * @return array{rows: list<array<string, mixed>>, totals: array<string, string>}
     */
    public function forMonth(User $user, string $month): array
    {
        $start = CarbonImmutable::createFromFormat('!Y-m', $month);
        $end = $start->endOfMonth();
        $currency = (string) $user->currency;
        $warning = (int) config('finance.budget_warning_percent', 80);

        $sums = DB::table('transactions')
            ->where('user_id', $user->getKey())
            ->where('kind', TransactionKind::Expense->value)
            ->whereNull('voided_at')
            ->whereBetween('occurred_on', [$start->toDateString(), $end->toDateString()])
            ->groupBy('category_id', 'status')
            ->selectRaw('category_id, status, SUM(amount) AS total')
            ->get();

        $spent = fn (int $categoryId, TransactionStatus $status): int => (int) ($sums
            ->first(fn (object $row) => (int) $row->category_id === $categoryId && $row->status === $status->value)
            ->total ?? 0);

        $budgets = Budget::query()->ownedBy($user)->pluck('amount', 'category_id');

        $categories = Category::query()
            ->ownedBy($user)
            ->where('kind', CategoryKind::Expense->value)
            ->orderBy('name')
            ->get()
            // Las archivadas solo aparecen si tienen presupuesto o gasto este mes.
            ->filter(fn (Category $category) => ! $category->isArchived()
                || $budgets->has($category->id)
                || $sums->contains(fn (object $row) => (int) $row->category_id === $category->id));

        $totals = ['limit' => 0, 'spent' => 0, 'planned' => 0];
        $rows = [];

        foreach ($categories as $category) {
            $limit = $budgets->has($category->id) ? (int) $budgets[$category->id] : null;
            $realized = $spent($category->id, TransactionStatus::Confirmed);
            $planned = $spent($category->id, TransactionStatus::Planned);

            if ($limit !== null) {
                $totals['limit'] += $limit;
            }
            $totals['spent'] += $realized;
            $totals['planned'] += $planned;

            $percent = $limit !== null && $limit > 0 ? (int) floor(($realized * 100) / $limit) : null;
            $committed = $realized + $planned;

            $rows[] = [
                'category' => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'color' => $category->color,
                    'archived' => $category->isArchived(),
                ],
                'limit' => $limit !== null ? Money::toDecimal($limit, $currency) : null,
                'spent' => Money::toDecimal($realized, $currency),
                'planned' => Money::toDecimal($planned, $currency),
                'remaining' => $limit !== null ? Money::toDecimal($limit - $committed, $currency) : null,
                'percent' => $percent,
                'status' => match (true) {
                    $limit === null => 'none',
                    $realized > $limit => 'over',
                    $committed > $limit => 'over_planned',
                    $percent !== null && $percent >= $warning => 'near',
                    default => 'ok',
                },
            ];
        }

        return [
            'rows' => $rows,
            'totals' => [
                'limit' => Money::toDecimal($totals['limit'], $currency),
                'spent' => Money::toDecimal($totals['spent'], $currency),
                'planned' => Money::toDecimal($totals['planned'], $currency),
            ],
        ];
    }
}
