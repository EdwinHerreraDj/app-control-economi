<?php

namespace App\Http\Controllers\Finance;

use App\Actions\Finance\ManageSavingsGoals;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\ContributionRequest;
use App\Http\Requests\Finance\SavingsGoalRequest;
use App\Models\SavingsContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SavingsGoalController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $goals = SavingsGoal::query()
            ->ownedBy($user)
            ->with(['contributions' => fn ($query) => $query->latest('contributed_on')->latest('id')])
            ->orderByRaw('archived_at IS NOT NULL')
            ->orderByRaw('achieved_at IS NOT NULL')
            ->orderBy('target_date')
            ->get()
            ->map(function (SavingsGoal $goal) {
                $saved = (int) $goal->contributions->sum('amount');
                $money = fn (int $amount) => Money::toDecimal($amount, $goal->currency);

                return [
                    'id' => $goal->id,
                    'name' => $goal->name,
                    'icon' => $goal->icon,
                    'color' => $goal->color,
                    'target_amount' => $money($goal->target_amount),
                    'saved' => $money($saved),
                    'remaining' => $money(max(0, $goal->target_amount - $saved)),
                    'percent' => $goal->target_amount > 0 ? min(100, (int) floor($saved * 100 / $goal->target_amount)) : 0,
                    'target_date' => $goal->target_date?->toDateString(),
                    'achieved' => $goal->achieved_at !== null,
                    'archived' => $goal->archived_at !== null,
                    'contributions' => $goal->contributions->take(20)->map(fn (SavingsContribution $c) => [
                        'id' => $c->id,
                        'amount' => $money($c->amount),
                        'contributed_on' => $c->contributed_on->toDateString(),
                        'note' => $c->note,
                    ])->values(),
                ];
            });

        return Inertia::render('finance/goals/index', [
            'goals' => $goals,
            'icons' => config('finance.icons'),
            'colors' => config('finance.colors'),
            'today' => $user->today()->toDateString(),
        ]);
    }

    public function store(SavingsGoalRequest $request, ManageSavingsGoals $goals): RedirectResponse
    {
        $goals->create($request->user(), $request->payload());
        $this->toast('Objetivo creado.');

        return back();
    }

    public function update(SavingsGoalRequest $request, SavingsGoal $goal, ManageSavingsGoals $goals): RedirectResponse
    {
        Gate::authorize('update', $goal);

        $goals->update($goal, $request->payload());
        $this->toast('Objetivo actualizado.');

        return back();
    }

    public function contribute(ContributionRequest $request, SavingsGoal $goal, ManageSavingsGoals $goals): RedirectResponse
    {
        Gate::authorize('update', $goal);

        $wasAchieved = $goal->achieved_at !== null;
        $goals->contribute(
            $goal,
            $request->signedAmount(),
            $request->string('contributed_on')->toString(),
            $request->optionalString('note'),
        );

        $this->toast(! $wasAchieved && $goal->refresh()->achieved_at !== null
            ? "¡Has alcanzado «{$goal->name}»!"
            : 'Aportación registrada.');

        return back();
    }

    public function archive(SavingsGoal $goal, ManageSavingsGoals $goals): RedirectResponse
    {
        Gate::authorize('update', $goal);

        $goals->archive($goal);
        $this->toast("«{$goal->name}» se ha archivado.");

        return back();
    }

    public function restore(SavingsGoal $goal, ManageSavingsGoals $goals): RedirectResponse
    {
        Gate::authorize('update', $goal);

        $goals->restore($goal);
        $this->toast("«{$goal->name}» vuelve a estar activo.");

        return back();
    }
}
