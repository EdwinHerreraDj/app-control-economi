<?php

namespace App\Http\Controllers\Finance;

use App\Actions\Finance\ManageDebts;
use App\Enums\CategoryKind;
use App\Enums\Frequency;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\DebtPaymentRequest;
use App\Http\Requests\Finance\DebtRequest;
use App\Http\Requests\Finance\VoidRequest;
use App\Models\Account;
use App\Models\Category;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DebtController extends Controller
{
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $debts = Debt::query()
            ->ownedBy($user)
            ->with(['payments' => fn ($query) => $query->latest('paid_on')->latest('id'), 'payments.account:id,name'])
            ->orderByRaw('settled_at IS NOT NULL')
            ->orderBy('next_due_on')
            ->orderBy('creditor')
            ->get();

        $totalOutstanding = 0;

        $rows = $debts->map(function (Debt $debt) use (&$totalOutstanding) {
            $active = $debt->payments->whereNull('voided_at');
            $repaid = (int) $active->sum('principal_amount');
            $outstanding = max(0, $debt->principal - $repaid);
            $totalOutstanding += $debt->isSettled() ? 0 : $outstanding;
            $money = fn (?int $amount) => $amount !== null ? Money::toDecimal($amount, $debt->currency) : null;

            return [
                'id' => $debt->id,
                'creditor' => $debt->creditor,
                'concept' => $debt->concept,
                'currency' => $debt->currency,
                'principal' => $money($debt->principal),
                'outstanding' => $money($outstanding),
                'repaid_percent' => $debt->principal > 0 ? (int) floor($repaid * 100 / $debt->principal) : 100,
                'interest_paid' => $money((int) $active->sum('interest_amount')),
                'fees_paid' => $money((int) $active->sum('fees_amount')),
                'started_on' => $debt->started_on->toDateString(),
                'installment' => $money($debt->installment),
                'frequency' => $debt->frequency?->value,
                'frequency_label' => $debt->frequency?->label(),
                'next_due_on' => $debt->next_due_on?->toDateString(),
                'interest_rate' => $debt->interest_rate,
                'notes' => $debt->notes,
                'settled' => $debt->isSettled(),
                'has_payments' => $active->isNotEmpty(),
                'payments' => $debt->payments->map(fn (DebtPayment $payment) => [
                    'id' => $payment->id,
                    'paid_on' => $payment->paid_on->toDateString(),
                    'account' => $payment->account->name,
                    'principal' => $money($payment->principal_amount),
                    'interest' => $money($payment->interest_amount),
                    'fees' => $money($payment->fees_amount),
                    'total' => $money($payment->total()),
                    'notes' => $payment->notes,
                    'voided' => $payment->isVoided(),
                    'void_reason' => $payment->void_reason,
                ])->values(),
            ];
        });

        $interestCategory = Category::query()->ownedBy($user)
            ->where('kind', CategoryKind::Expense->value)
            ->where('name', 'Comisiones e intereses')
            ->value('id');

        return Inertia::render('finance/debts/index', [
            'debts' => $rows,
            'totalOutstanding' => Money::toDecimal($totalOutstanding, (string) $user->currency),
            'accounts' => Account::query()->ownedBy($user)->active()->orderBy('name')->get(['id', 'name']),
            'expenseCategories' => Category::query()->ownedBy($user)->active()
                ->where('kind', CategoryKind::Expense->value)->orderBy('name')->get(['id', 'name']),
            'defaultCategoryId' => $interestCategory,
            'frequencies' => collect(Frequency::cases())->map(fn (Frequency $f) => ['value' => $f->value, 'label' => $f->label()]),
            'today' => $user->today()->toDateString(),
        ]);
    }

    public function store(DebtRequest $request, ManageDebts $debts): RedirectResponse
    {
        /** @var array{creditor: string, concept: string, principal: int, started_on: string, installment: int|null, frequency: Frequency|null, next_due_on: string|null, interest_rate: string|null, notes: string|null} $payload */
        $payload = $request->payload();
        $debts->create($request->user(), [...$payload, 'disbursement_account' => $request->disbursementAccount()]);
        $this->toast('Deuda registrada.');

        return back();
    }

    public function update(DebtRequest $request, Debt $debt, ManageDebts $debts): RedirectResponse
    {
        Gate::authorize('update', $debt);

        /** @var array{creditor: string, concept: string, principal: int, started_on: string, installment: int|null, frequency: Frequency|null, next_due_on: string|null, interest_rate: string|null, notes: string|null} $payload */
        $payload = $request->payload();
        $debts->update($debt, $payload);
        $this->toast('Deuda actualizada.');

        return back();
    }

    public function storePayment(DebtPaymentRequest $request, Debt $debt, ManageDebts $debts): RedirectResponse
    {
        Gate::authorize('update', $debt);

        $debts->recordPayment($debt, $request->payload());
        $this->toast($debt->refresh()->isSettled()
            ? '¡Deuda saldada! Has devuelto todo el capital.'
            : 'Pago registrado.');

        return back();
    }

    public function voidPayment(VoidRequest $request, DebtPayment $payment, ManageDebts $debts): RedirectResponse
    {
        Gate::authorize('update', $payment);

        $debts->voidPayment($payment, $request->string('reason')->toString());
        $this->toast('Pago anulado. El capital vuelve a figurar como pendiente.');

        return back();
    }
}
