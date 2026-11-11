<?php

namespace App\Http\Controllers;

use App\Finance\BudgetReport;
use App\Finance\FinancialInsights;
use App\Finance\LiquidityForecast;
use App\Finance\UpcomingCommitments;
use App\Mascots\MascotCompanion;
use App\Models\DebtPayment;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        FinancialInsights $insights,
        LiquidityForecast $forecast,
        UpcomingCommitments $upcoming,
        BudgetReport $budgets,
        MascotCompanion $companion,
    ): Response {
        /** @var User $user */
        $user = $request->user();
        $today = $user->today();
        $currency = (string) $user->currency;

        $projection = $forecast->forUser($user, (int) config('finance.forecast_days', 30));
        $quality = $insights->dataQuality($user);
        $months = $insights->monthlyTotals($user, 6);
        $zero = Money::toDecimal(0, $currency);
        $current = $months[array_key_last($months)] ?? ['income' => $zero, 'expense' => $zero, 'net' => $zero];

        // Pagos de deuda del mes: capital + intereses + comisiones (una sola vez).
        $debtPaid = (int) DebtPayment::query()->ownedBy($user)->whereNull('voided_at')
            ->whereBetween('paid_on', [$today->startOfMonth()->toDateString(), $today->endOfMonth()->toDateString()])
            ->selectRaw('COALESCE(SUM(principal_amount + interest_amount + fees_amount), 0) AS total')
            ->value('total');

        $budgetRows = collect($budgets->forMonth($user, $today->format('Y-m'))['rows'])
            ->where('status', '!=', 'none')
            ->sortByDesc('percent')
            ->take(3)
            ->values();

        $goals = SavingsGoal::query()->ownedBy($user)->whereNull('archived_at')->whereNull('achieved_at')
            ->withSum('contributions', 'amount')->orderBy('target_date')->take(3)->get()
            ->map(fn (SavingsGoal $goal) => [
                'id' => $goal->id,
                'name' => $goal->name,
                'icon' => $goal->icon,
                'color' => $goal->color,
                'saved' => Money::toDecimal((int) $goal->contributions_sum_amount, $goal->currency),
                'target_amount' => Money::toDecimal($goal->target_amount, $goal->currency),
                'percent' => $goal->target_amount > 0
                    ? min(100, (int) floor((int) $goal->contributions_sum_amount * 100 / $goal->target_amount))
                    : 0,
            ]);

        $headline = $insights->headline($user, $projection, $quality);

        return Inertia::render('dashboard', [
            'headline' => $headline,
            // La mascota usa los mismos cálculos que el panel.
            'mascot' => $companion->forDashboard($user, $headline, $projection, $request->session()),
            'balance' => $projection['real'] ?? Money::toDecimal(0, $currency),
            'month' => [
                'income' => $current['income'],
                'expense' => $current['expense'],
                'net' => $current['net'],
                'debt_paid' => Money::toDecimal($debtPaid, $currency),
            ],
            'forecast' => $projection !== null ? collect($projection)->except('minor')->all() : null,
            'savings' => $insights->savingsCapacity($user),
            'evolution' => $months,
            'upcoming' => array_slice($upcoming->forUser($user, 14), 0, 6),
            'budgets' => $budgetRows,
            'goals' => $goals,
            'quality' => $quality,
        ]);
    }
}
