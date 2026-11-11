<?php

namespace App\Http\Controllers;

use App\Enums\CategoryKind;
use App\Finance\FinancialInsights;
use App\Finance\LiquidityForecast;
use App\Finance\MoneyOverview;
use App\Finance\Notices;
use App\Mascots\MascotCompanion;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inicio («Mi dinero»): cuánto tengo, cuánto me ha entrado y he gastado este
 * mes, qué me toca pagar pronto y cuánto debo todavía.
 */
class DashboardController extends Controller
{
    public function __invoke(
        Request $request,
        MoneyOverview $overview,
        Notices $notices,
        FinancialInsights $insights,
        LiquidityForecast $forecast,
        MascotCompanion $companion,
    ): Response {
        /** @var User $user */
        $user = $request->user();

        // La mascota sigue usando el mismo diagnóstico que antes.
        $projection = $forecast->forUser($user, (int) config('finance.forecast_days', 30));
        $headline = $insights->headline($user, $projection, $insights->dataQuality($user));

        return Inertia::render('dashboard', [
            'overview' => $overview->forUser($user),
            'notices' => $notices->forUser($user),
            'mascot' => $companion->forDashboard($user, $headline, $projection, $request->session()),
            // Solo a quien empieza de cero: quien ya tiene cuentas no lo necesita.
            'needsSetup' => ! $user->hasCompletedSetup() && ! $user->accounts()->exists(),
            'firstName' => explode(' ', trim($user->name))[0],
            'today' => $user->today()->toDateString(),
            'interestCategoryId' => Category::query()->ownedBy($user)
                ->where('kind', CategoryKind::Expense->value)
                ->where('name', 'Comisiones e intereses')
                ->value('id'),
        ]);
    }
}
