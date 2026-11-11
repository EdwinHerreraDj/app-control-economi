<?php

namespace App\Http\Controllers\Finance;

use App\Actions\Finance\ManageRecurringRules;
use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Finance\UpcomingCommitments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\RecurringRuleRequest;
use App\Models\Account;
use App\Models\Category;
use App\Models\RecurringRule;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class RecurringRuleController extends Controller
{
    public function index(Request $request, UpcomingCommitments $upcoming): Response
    {
        /** @var User $user */
        $user = $request->user();
        $today = $user->today();

        $rules = RecurringRule::query()
            ->ownedBy($user)
            ->with(['account:id,name', 'category:id,name,icon,color'])
            ->orderByRaw('paused_at IS NOT NULL')
            ->orderBy('concept')
            ->get()
            ->map(fn (RecurringRule $rule) => [
                'id' => $rule->id,
                'kind' => $rule->kind->value,
                'concept' => $rule->concept,
                'amount' => Money::toDecimal($rule->amount, $rule->currency),
                'currency' => $rule->currency,
                'account' => ['id' => $rule->account->id, 'name' => $rule->account->name],
                'category' => [
                    'id' => $rule->category->id,
                    'name' => $rule->category->name,
                    'icon' => $rule->category->icon,
                    'color' => $rule->category->color,
                ],
                'nature' => $rule->nature?->value,
                'frequency' => $rule->frequency->value,
                'frequency_label' => $rule->frequency->label(),
                'starts_on' => $rule->starts_on->toDateString(),
                'ends_on' => $rule->ends_on?->toDateString(),
                'next_on' => $rule->isPaused() ? null : $rule->nextOccurrence($today)?->toDateString(),
                'paused' => $rule->isPaused(),
            ]);

        return Inertia::render('finance/recurring/index', [
            'rules' => $rules,
            'upcoming' => $upcoming->forUser($user),
            'upcomingDays' => (int) config('finance.upcoming_days', 45),
            'accounts' => Account::query()->ownedBy($user)->orderBy('name')->get(['id', 'name', 'archived_at'])
                ->map(fn (Account $account) => ['id' => $account->id, 'name' => $account->name, 'archived' => $account->isArchived()]),
            'categories' => Category::query()->ownedBy($user)->orderBy('name')->get(['id', 'kind', 'name', 'icon', 'color', 'archived_at'])
                ->map(fn (Category $category) => [
                    'id' => $category->id,
                    'kind' => $category->kind->value,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'color' => $category->color,
                    'archived' => $category->isArchived(),
                ]),
            'frequencies' => collect(Frequency::cases())->map(fn (Frequency $f) => ['value' => $f->value, 'label' => $f->label()]),
            'today' => $today->toDateString(),
        ]);
    }

    public function store(RecurringRuleRequest $request, ManageRecurringRules $rules): RedirectResponse
    {
        /** @var array{kind: TransactionKind, account: Account, category: Category, amount: int, concept: string, nature: ExpenseNature|null, frequency: Frequency, starts_on: string, ends_on: string|null} $payload */
        $payload = $request->payload();
        $rules->create($request->user(), $payload);
        $this->toast('Recurrencia creada. Sus próximas fechas aparecen como previstas.');

        return back();
    }

    public function update(RecurringRuleRequest $request, RecurringRule $rule, ManageRecurringRules $rules): RedirectResponse
    {
        Gate::authorize('update', $rule);

        /** @var array{account: Account, category: Category, amount: int, concept: string, nature: ExpenseNature|null, frequency: Frequency, starts_on: string, ends_on: string|null} $payload */
        $payload = $request->payload();
        $rules->update($rule, $payload);
        $this->toast('Recurrencia actualizada. Las previsiones futuras se han recalculado.');

        return back();
    }

    public function pause(RecurringRule $rule, ManageRecurringRules $rules): RedirectResponse
    {
        Gate::authorize('update', $rule);

        $rules->pause($rule);
        $this->toast('Recurrencia en pausa. Se han quitado sus previsiones pendientes.');

        return back();
    }

    public function resume(RecurringRule $rule, ManageRecurringRules $rules): RedirectResponse
    {
        Gate::authorize('update', $rule);

        $rules->resume($rule);
        $this->toast('Recurrencia reanudada.');

        return back();
    }

    public function destroy(RecurringRule $rule, ManageRecurringRules $rules): RedirectResponse
    {
        Gate::authorize('delete', $rule);

        $rules->delete($rule);
        $this->toast('Recurrencia eliminada. Los movimientos ya confirmados se conservan.');

        return back();
    }
}
