<?php

namespace App\Http\Controllers;

use App\Finance\MonthSummary;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * «Mis meses»: qué entró, qué salió y en qué, mes a mes.
 */
class MonthController extends Controller
{
    public function __invoke(Request $request, MonthSummary $summary): Response
    {
        /** @var User $user */
        $user = $request->user();
        $current = $user->today()->startOfMonth();
        $requested = (string) $request->query('month', '');

        $month = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $requested)
            ? CarbonImmutable::createFromFormat('!Y-m', $requested, $user->timezone)
            : $current;

        // No tiene sentido mirar meses futuros: aún no ha pasado nada.
        if ($month->greaterThan($current)) {
            $month = $current;
        }

        return Inertia::render('months/index', [
            'summary' => $summary->forMonth($user, $month),
            'previous' => $month->subMonthNoOverflow()->format('Y-m'),
            'next' => $month->lessThan($current) ? $month->addMonthNoOverflow()->format('Y-m') : null,
            'isCurrent' => $month->equalTo($current),
        ]);
    }
}
