<?php

namespace App\Http\Controllers;

use App\Actions\Finance\ManageAccounts;
use App\Actions\Finance\ManageDebts;
use App\Actions\Finance\ManageRecurringRules;
use App\Enums\AccountType;
use App\Enums\CategoryKind;
use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Finance\AccountBalances;
use App\Finance\CategoryGuesser;
use App\Models\Account;
use App\Models\Category;
use App\Models\Debt;
use App\Models\RecurringRule;
use App\Models\User;
use App\Rules\MoneyAmount;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Primera configuración: cuatro preguntas sencillas para conocer la
 * economía de la persona. Cada una se puede omitir y completar después.
 *
 * Nada de lo que se apunta aquí cuenta como ingreso o gasto del mes: el
 * dinero de hoy es el saldo inicial, los cobros y pagos habituales quedan
 * pendientes hasta que ocurren, y lo ya pagado de una deuda no mueve dinero.
 */
class SetupController extends Controller
{
    private const MAX_ITEMS = 20;

    public function show(Request $request, AccountBalances $balances): Response
    {
        /** @var User $user */
        $user = $request->user();
        $amounts = $balances->forUser($user);
        $currency = (string) $user->currency;

        $rules = RecurringRule::query()->ownedBy($user)->orderBy('id')->get();

        return Inertia::render('setup', [
            'step' => (string) $request->query('paso', 'dinero'),
            'accounts' => Account::query()->ownedBy($user)->active()->orderBy('id')->get()
                ->map(fn (Account $a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'type' => $a->type->value,
                    'balance' => Money::toDecimal($amounts[$a->id] ?? 0, $a->currency),
                ]),
            'incomes' => $rules->where('kind', TransactionKind::Income)->values()
                ->map(fn (RecurringRule $r) => $this->presentRule($r)),
            'payments' => $rules->where('kind', TransactionKind::Expense)->values()
                ->map(fn (RecurringRule $r) => $this->presentRule($r)),
            'debts' => Debt::query()->ownedBy($user)->whereNull('settled_at')->orderBy('id')->get()
                ->map(fn (Debt $d) => [
                    'id' => $d->id,
                    'concept' => $d->concept,
                    'outstanding' => Money::toDecimal($d->outstanding(), $d->currency),
                    'installment' => $d->installment !== null ? Money::toDecimal($d->installment, $d->currency) : null,
                    'frequency' => $d->frequency?->value,
                ]),
            'currency' => $currency,
            'today' => $user->today()->toDateString(),
        ]);
    }

    /**
     * Pregunta 1: ¿cuánto dinero tienes ahora? Crea las cuentas con su saldo
     * inicial (no es un ingreso). Si ya existen, no se tocan.
     */
    public function money(Request $request, ManageAccounts $accounts): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $amount = new MoneyAmount((string) $user->currency, allowZero: true, allowNegative: true);

        $validated = $request->validate([
            'bank' => ['nullable', $amount],
            'cash' => ['nullable', $amount],
            'savings' => ['nullable', $amount],
        ], [], ['bank' => 'dinero en el banco', 'cash' => 'efectivo', 'savings' => 'ahorros']);

        $minor = fn (string $key) => isset($validated[$key]) && $validated[$key] !== ''
            ? Money::toMinor((string) $validated[$key], (string) $user->currency, allowNegative: true)
            : null;

        $existing = Account::query()->ownedBy($user)->active()->get();
        $has = fn (AccountType $type) => $existing->contains(fn (Account $a) => $a->type === $type);

        DB::transaction(function () use ($user, $accounts, $minor, $has, $existing) {
            if (! $has(AccountType::Bank) && ($minor('bank') !== null || $existing->isEmpty())) {
                $accounts->create($user, 'Banco', AccountType::Bank, $minor('bank') ?? 0);
            }

            if (! $has(AccountType::Cash) && $minor('cash')) {
                $accounts->create($user, 'Efectivo', AccountType::Cash, $minor('cash'));
            }

            // Una cuenta donde se va guardando dinero: no cuenta como dinero
            // para gastar, pero sí como dinero tuyo.
            if (! $has(AccountType::Savings) && $minor('savings')) {
                $accounts->create($user, 'Ahorros', AccountType::Savings, $minor('savings'));
            }
        });

        return to_route('setup.show', ['paso' => 'ingresos']);
    }

    /**
     * Pregunta 2: ¿cuánto cobras normalmente? Quedan como cobros pendientes:
     * no suman al dinero disponible hasta confirmar que han llegado.
     */
    public function incomes(Request $request, ManageRecurringRules $rules, CategoryGuesser $guesser): RedirectResponse
    {
        $this->storeRules($request, $rules, $guesser, TransactionKind::Income);

        return to_route('setup.show', ['paso' => 'pagos']);
    }

    /**
     * Pregunta 3: ¿qué cosas pagas habitualmente? Quedan como pagos
     * pendientes; nada se descuenta hasta pulsar «Ya lo pagué».
     */
    public function payments(Request $request, ManageRecurringRules $rules, CategoryGuesser $guesser): RedirectResponse
    {
        $this->storeRules($request, $rules, $guesser, TransactionKind::Expense);

        return to_route('setup.show', ['paso' => 'deudas']);
    }

    /**
     * Pregunta 4: ¿debes dinero? La deuda no es un gasto: solo los pagos que
     * se hagan a partir de ahora mueven dinero.
     */
    public function debts(Request $request, ManageDebts $debts): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $currency = (string) $user->currency;
        $amount = new MoneyAmount($currency);

        $validated = $request->validate([
            'items' => ['present', 'array', 'max:'.self::MAX_ITEMS],
            'items.*.concept' => ['required', 'string', 'max:255'],
            'items.*.creditor' => ['nullable', 'string', 'max:100'],
            'items.*.total' => ['required', $amount],
            'items.*.installment' => ['nullable', $amount],
            'items.*.frequency' => ['nullable', Rule::enum(Frequency::class)],
            'items.*.paid_installments' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'items.*.paid_amount' => ['nullable', new MoneyAmount($currency, allowZero: true)],
            'items.*.next_due_on' => ['nullable', 'date_format:Y-m-d'],
        ], [], [
            'items.*.concept' => '¿qué es?',
            'items.*.total' => 'cuánto debías en total',
            'items.*.installment' => 'cuánto pagas por cuota',
            'items.*.paid_amount' => 'cuánto has pagado ya',
            'items.*.next_due_on' => 'cuándo toca la próxima',
        ]);

        $toMinor = fn (mixed $value) => $value !== null && $value !== '' ? Money::toMinor((string) $value, $currency) : null;

        DB::transaction(function () use ($validated, $toMinor, $debts, $user) {
            foreach ($validated['items'] as $index => $item) {
                $total = (int) $toMinor($item['total']);
                $installment = $toMinor($item['installment'] ?? null);
                $paid = $toMinor($item['paid_amount'] ?? null)
                    ?? ($installment !== null ? $installment * (int) ($item['paid_installments'] ?? 0) : 0);

                if ($paid > $total) {
                    throw ValidationException::withMessages([
                        "items.{$index}.paid_amount" => 'Lo ya pagado no puede ser más de lo que debías.',
                    ]);
                }

                $frequency = isset($item['frequency']) ? Frequency::from($item['frequency']) : null;
                $nextDue = $item['next_due_on'] ?? null;

                $debts->create($user, [
                    'creditor' => $item['creditor'] ?? null,
                    'concept' => $item['concept'],
                    'principal' => $total,
                    'paid_before' => $paid,
                    'started_on' => $user->today()->toDateString(),
                    'installment' => $installment,
                    // Con cuota (o fecha) hay periodicidad; sin fecha no hay calendario.
                    'frequency' => $installment !== null || $nextDue !== null ? ($frequency ?? Frequency::Monthly) : null,
                    'next_due_on' => $nextDue,
                    'interest_rate' => null,
                    'notes' => null,
                    'disbursement_account' => null,
                ]);
            }
        });

        return to_route('setup.show', ['paso' => 'resumen']);
    }

    public function finish(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->forceFill(['setup_completed_at' => now()])->save();

        $this->toast('¡Listo! Ya puedes apuntar lo que gastas y lo que te entra.');

        return to_route('dashboard');
    }

    private function storeRules(Request $request, ManageRecurringRules $rules, CategoryGuesser $guesser, TransactionKind $kind): void
    {
        /** @var User $user */
        $user = $request->user();
        $currency = (string) $user->currency;

        $validated = $request->validate([
            'items' => ['present', 'array', 'max:'.self::MAX_ITEMS],
            'items.*.concept' => ['required', 'string', 'max:255'],
            'items.*.amount' => ['required', new MoneyAmount($currency)],
            'items.*.frequency' => ['required', Rule::enum(Frequency::class)],
            'items.*.next_on' => ['required', 'date_format:Y-m-d'],
            'items.*.variable' => ['boolean'],
        ], [], [
            'items.*.concept' => '¿qué es?',
            'items.*.amount' => 'importe',
            'items.*.frequency' => 'cada cuánto',
            'items.*.next_on' => 'cuándo toca',
        ]);

        $account = Account::query()->ownedBy($user)->active()
            ->orderByRaw("type = 'savings'")->orderBy('id')->first();

        if ($validated['items'] !== [] && $account === null) {
            throw ValidationException::withMessages(['items' => 'Primero dinos cuánto dinero tienes (paso anterior).']);
        }

        $categoryKind = $kind === TransactionKind::Income ? CategoryKind::Income : CategoryKind::Expense;

        DB::transaction(function () use ($validated, $rules, $guesser, $user, $account, $kind, $categoryKind, $currency) {
            foreach ($validated['items'] as $item) {
                /** @var Category|null $category */
                $category = $guesser->guess($user, $categoryKind, $item['concept'])
                    ?? $guesser->fallback($user, $categoryKind);

                if ($category === null || $account === null) {
                    continue;
                }

                $rules->create($user, [
                    'kind' => $kind,
                    'account' => $account,
                    'category' => $category,
                    'amount' => Money::toMinor((string) $item['amount'], $currency),
                    'concept' => $item['concept'],
                    'nature' => ($item['variable'] ?? false) ? ExpenseNature::Variable : ExpenseNature::Fixed,
                    'frequency' => Frequency::from($item['frequency']),
                    'starts_on' => $item['next_on'],
                    'ends_on' => null,
                ]);
            }
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function presentRule(RecurringRule $rule): array
    {
        return [
            'id' => $rule->id,
            'concept' => $rule->concept,
            'amount' => Money::toDecimal($rule->amount, $rule->currency),
            'frequency' => $rule->frequency->value,
            'frequency_label' => $rule->frequency->label(),
            'variable' => $rule->nature === ExpenseNature::Variable,
        ];
    }
}
