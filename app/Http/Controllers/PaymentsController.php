<?php

namespace App\Http\Controllers;

use App\Enums\CategoryKind;
use App\Enums\Frequency;
use App\Finance\MoneyOverview;
use App\Models\Account;
use App\Models\Category;
use App\Models\Debt;
use App\Models\RecurringRule;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * «Mis pagos»: lo que toca pagar y cobrar, los pagos habituales y lo que
 * se debe. Las acciones reutilizan las de movimientos, recurrencias y
 * deudas, así que las reglas (y sus pruebas) son las mismas.
 */
class PaymentsController extends Controller
{
    public function __invoke(Request $request, MoneyOverview $overview): Response
    {
        /** @var User $user */
        $user = $request->user();
        $summary = $overview->forUser($user);

        $rules = RecurringRule::query()->ownedBy($user)
            ->with(['account:id,name', 'category:id,name,icon,color'])
            ->orderBy('kind')
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
                'next_on' => $rule->isPaused() ? null : $rule->nextOccurrence($user->today())?->toDateString(),
                'paused' => $rule->isPaused(),
            ]);

        $debts = Debt::query()->ownedBy($user)
            ->orderByRaw('settled_at IS NOT NULL')
            ->orderBy('next_due_on')
            ->orderBy('concept')
            ->get()
            ->map(function (Debt $debt) {
                $money = fn (?int $minor) => $minor !== null ? Money::toDecimal($minor, $debt->currency) : null;
                $outstanding = $debt->outstanding();
                $paid = $debt->paidTotal();
                $left = $debt->installment ? (int) ceil($outstanding / $debt->installment) : null;

                // Fecha estimada de fin: la de la última cuota, si hay plan.
                $ends = $left && $debt->frequency && $debt->next_due_on
                    ? $debt->frequency->occurrence($debt->next_due_on, $left - 1)->toDateString()
                    : null;

                return [
                    'id' => $debt->id,
                    'concept' => $debt->concept,
                    'creditor' => $debt->creditor,
                    'principal' => $money($debt->principal),
                    'paid' => $money($paid),
                    'paid_before' => $money($debt->paid_before),
                    'outstanding' => $money($outstanding),
                    'percent' => $debt->principal > 0 ? (int) floor($paid * 100 / $debt->principal) : 100,
                    'installment' => $money($debt->installment),
                    'next_installment' => $money($debt->installment !== null ? min($debt->installment, $outstanding) : null),
                    'installments_left' => $left,
                    'frequency' => $debt->frequency?->value,
                    'frequency_label' => $debt->frequency?->label(),
                    'next_due_on' => $debt->next_due_on?->toDateString(),
                    'ends_on' => $ends,
                    'started_on' => $debt->started_on->toDateString(),
                    'settled' => $debt->isSettled(),
                ];
            });

        return Inertia::render('payments/index', [
            'upcoming' => $summary['upcoming'],
            'rules' => $rules,
            'debts' => $debts,
            'owed' => $summary['debts']['owed'],
            'accounts' => Account::query()->ownedBy($user)->active()->orderBy('name')->get(['id', 'name', 'type'])
                ->map(fn (Account $a) => ['id' => $a->id, 'name' => $a->name, 'archived' => false, 'savings' => $a->type->value === 'savings']),
            'categories' => Category::query()->ownedBy($user)->active()->orderBy('name')->get(['id', 'kind', 'name', 'icon', 'color'])
                ->map(fn (Category $c) => [
                    'id' => $c->id, 'kind' => $c->kind->value, 'name' => $c->name,
                    'icon' => $c->icon, 'color' => $c->color, 'archived' => false,
                ]),
            'interestCategoryId' => Category::query()->ownedBy($user)
                ->where('kind', CategoryKind::Expense->value)
                ->where('name', 'Comisiones e intereses')
                ->value('id'),
            'frequencies' => collect(Frequency::cases())->map(fn (Frequency $f) => ['value' => $f->value, 'label' => $f->label()]),
            'today' => $user->today()->toDateString(),
        ]);
    }
}
