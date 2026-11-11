<?php

namespace App\Http\Controllers\Finance;

use App\Enums\CategoryKind;
use App\Finance\FinancialInsights;
use App\Finance\LiquidityForecast;
use App\Http\Controllers\Controller;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StatisticsController extends Controller
{
    private const PERIODS = [3, 6, 12];

    private const FORECAST_DAYS = [30, 60, 90];

    public function __invoke(Request $request, FinancialInsights $insights, LiquidityForecast $forecast): Response
    {
        /** @var User $user */
        $user = $request->user();
        $months = in_array($request->integer('months'), self::PERIODS, true) ? $request->integer('months') : 6;
        $days = in_array($request->integer('days'), self::FORECAST_DAYS, true) ? $request->integer('days') : 60;

        $monthParam = (string) $request->query('month', '');
        $month = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $monthParam)
            ? CarbonImmutable::createFromFormat('!Y-m', $monthParam)
            : $user->today()->startOfMonth();

        $periodStart = $user->today()->startOfMonth()->subMonthsNoOverflow($months - 1);
        $periodEnd = $user->today()->endOfMonth();
        $projection = $forecast->forUser($user, $days);

        return Inertia::render('finance/statistics/index', [
            'filters' => ['months' => $months, 'days' => $days, 'month' => $month->format('Y-m')],
            'periods' => self::PERIODS,
            'forecastOptions' => self::FORECAST_DAYS,
            'evolution' => $insights->monthlyTotals($user, $months),
            'categories' => $insights->categoryBreakdown($user, $periodStart, $periodEnd),
            'incomeCategories' => $insights->categoryBreakdown($user, $periodStart, $periodEnd, CategoryKind::Income),
            'comparison' => $insights->comparison($user, $month),
            'debt' => $insights->debtEvolution($user, $months),
            'budgets' => $insights->budgetCompliance($user, $months),
            'goals' => SavingsGoal::query()->ownedBy($user)->whereNull('archived_at')
                ->withSum('contributions', 'amount')->orderBy('name')->get()
                ->map(fn (SavingsGoal $goal) => [
                    'id' => $goal->id,
                    'name' => $goal->name,
                    'saved' => Money::toDecimal((int) $goal->contributions_sum_amount, $goal->currency),
                    'target_amount' => Money::toDecimal($goal->target_amount, $goal->currency),
                    'percent' => $goal->target_amount > 0
                        ? min(100, (int) floor((int) $goal->contributions_sum_amount * 100 / $goal->target_amount))
                        : 0,
                    'achieved' => $goal->achieved_at !== null,
                ]),
            'forecast' => $projection !== null ? collect($projection)->except('minor')->all() : null,
            'savings' => $insights->savingsCapacity($user),
            'quality' => $insights->dataQuality($user),
        ]);
    }
}
