<?php

namespace App\Http\Controllers\Finance;

use App\Enums\CategoryKind;
use App\Finance\BudgetReport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\BudgetRequest;
use App\Models\Budget;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function index(Request $request, BudgetReport $report): Response
    {
        /** @var User $user */
        $user = $request->user();
        $month = (string) $request->query('month', '');

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            $month = $user->today()->format('Y-m');
        }

        return Inertia::render('finance/budgets/index', [
            'month' => $month,
            ...$report->forMonth($user, $month),
            'warningPercent' => (int) config('finance.budget_warning_percent', 80),
        ]);
    }

    /**
     * Crea o cambia el límite mensual de una categoría de gasto.
     */
    public function upsert(BudgetRequest $request, Category $category): RedirectResponse
    {
        Gate::authorize('update', $category);

        if ($category->kind !== CategoryKind::Expense) {
            throw ValidationException::withMessages(['amount' => 'Los presupuestos se aplican a categorías de gasto.']);
        }

        /** @var User $user */
        $user = $request->user();
        $budget = Budget::query()->ownedBy($user)->where('category_id', $category->id)->first();

        if ($budget === null) {
            $budget = new Budget(['category_id' => $category->id]);
            $budget->user()->associate($user);
        }

        $budget->fill([
            'amount' => (int) $request->minor('amount'),
            'currency' => (string) $user->currency,
        ])->save();

        $this->toast("Presupuesto de «{$category->name}» guardado.");

        return back();
    }

    public function destroy(Request $request, Category $category): RedirectResponse
    {
        Gate::authorize('update', $category);

        Budget::query()->ownedBy($request->user())->where('category_id', $category->id)->delete();
        $this->toast("Se ha quitado el presupuesto de «{$category->name}».");

        return back();
    }
}
