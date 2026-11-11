<?php

use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Finance\AccountBalances;
use App\Finance\RecurringGenerator;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\RecurringRule;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-11 10:00', 'Europe/Madrid'));

    $this->user = User::factory()->create(['currency' => 'EUR', 'timezone' => 'Europe/Madrid']);
    $this->account = Account::factory()->for($this->user)->create(['initial_balance' => 100000]);
    $this->expense = Category::factory()->for($this->user)->create(['name' => 'Comisiones e intereses']);
    $this->groceries = Category::factory()->for($this->user)->create(['name' => 'Comida']);
    $this->salary = Category::factory()->for($this->user)->income()->create(['name' => 'Nómina']);
});

function balance(Account $account): int
{
    return app(AccountBalances::class)->forAccount($account);
}

function createDebt(array $overrides = []): Debt
{
    test()->actingAs(test()->user)->post(route('debts.store'), [
        'creditor' => 'Banco Uno',
        'concept' => 'Préstamo coche',
        'principal' => '6000',
        'started_on' => '2026-11-01',
        'installment' => '250',
        'frequency' => 'monthly',
        'next_due_on' => '2026-12-01',
        'disbursement_account_id' => test()->account->id,
        ...$overrides,
    ])->assertSessionHasNoErrors();

    return Debt::latest('id')->firstOrFail();
}

function pay(Debt $debt, array $overrides = []): TestResponse
{
    return test()->actingAs(test()->user)->post(route('debts.payments.store', $debt), [
        'account_id' => test()->account->id,
        'category_id' => test()->expense->id,
        'paid_on' => '2026-11-10',
        'principal' => '200',
        'interest' => '40',
        'fees' => '10',
        'advances_schedule' => true,
        ...$overrides,
    ]);
}

describe('debts', function () {
    test('receiving a loan raises balance and debt but is not income', function () {
        $debt = createDebt();

        expect(balance($this->account))->toBe(100000 + 600000)
            ->and($debt->outstanding())->toBe(600000);

        $this->actingAs($this->user)
            ->get(route('transactions.index', ['month' => '2026-11']))
            ->assertInertia(fn (Assert $page) => $page->where('summary.income', '0.00'));
    });

    test('a payment splits principal (not expense) from interest and fees (expense)', function () {
        $debt = createDebt();
        pay($debt)->assertSessionHasNoErrors();

        expect($debt->outstanding())->toBe(600000 - 20000)
            ->and(balance($this->account))->toBe(700000 - 25000);

        $movements = Transaction::where('debt_payment_id', '!=', null)->get();
        expect($movements)->toHaveCount(2)
            ->and($movements->firstWhere('kind', TransactionKind::DebtOut)->amount)->toBe(20000)
            ->and($movements->firstWhere('kind', TransactionKind::Expense)->amount)->toBe(5000);

        // Solo intereses y comisiones cuentan como gasto del mes.
        $this->actingAs($this->user)
            ->get(route('transactions.index', ['month' => '2026-11']))
            ->assertInertia(fn (Assert $page) => $page->where('summary.expense', '50.00'));
    });

    test('paying an installment moves the next due date forward', function () {
        $debt = createDebt();
        pay($debt);

        expect($debt->refresh()->next_due_on->toDateString())->toBe('2027-01-01');
    });

    test('partial and early repayment settle the debt exactly at zero', function () {
        $debt = createDebt();
        pay($debt, ['principal' => '1000', 'interest' => '0', 'fees' => '0']);

        pay($debt, ['principal' => '5000.01', 'interest' => '0', 'fees' => '0'])
            ->assertSessionHasErrors('principal');

        pay($debt, ['principal' => '5000', 'interest' => '0', 'fees' => '0'])->assertSessionHasNoErrors();

        expect($debt->refresh()->isSettled())->toBeTrue()
            ->and($debt->outstanding())->toBe(0)
            ->and($debt->next_due_on)->toBeNull();
    });

    test('voiding a payment restores the outstanding principal and the balance', function () {
        $debt = createDebt();
        pay($debt, ['principal' => '6000', 'interest' => '0', 'fees' => '0']);
        expect($debt->refresh()->isSettled())->toBeTrue();

        $payment = $debt->payments()->firstOrFail();
        $this->actingAs($this->user)
            ->post(route('debts.payments.void', $payment), ['reason' => 'Error'])
            ->assertSessionHasNoErrors();

        expect($debt->refresh()->isSettled())->toBeFalse()
            ->and($debt->outstanding())->toBe(600000)
            ->and(balance($this->account))->toBe(700000);
    });

    test('interest needs an expense category and the principal cannot change after payments', function () {
        $debt = createDebt();

        pay($debt, ['category_id' => null])->assertSessionHasErrors('category_id');
        pay($debt, ['principal' => '0', 'interest' => '0', 'fees' => '0'])->assertSessionHasErrors('principal');

        pay($debt)->assertSessionHasNoErrors();

        $this->actingAs($this->user)->put(route('debts.update', $debt), [
            'creditor' => 'Banco Uno', 'concept' => 'Préstamo coche', 'principal' => '7000', 'started_on' => '2026-11-01',
        ])->assertSessionHasErrors('principal');
    });

    test('debt movements cannot be edited or voided from the movements screen', function () {
        $debt = createDebt();
        pay($debt);

        foreach (Transaction::whereNotNull('debt_id')->get() as $movement) {
            $this->actingAs($this->user)
                ->post(route('transactions.void', $movement), ['reason' => 'x'])
                ->assertSessionHasErrors('transaction');
        }
    });

    test('the debts screen lists outstanding amounts and history', function () {
        $debt = createDebt();
        pay($debt);

        $this->actingAs($this->user)
            ->get(route('debts.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('finance/debts/index')
                ->where('totalOutstanding', '5800.00')
                ->where('debts.0.outstanding', '5800.00')
                ->where('debts.0.interest_paid', '40.00')
                ->has('debts.0.payments', 1));
    });
});

describe('recurring rules', function () {
    function createRule(array $overrides = []): RecurringRule
    {
        test()->actingAs(test()->user)->post(route('recurring.store'), [
            'kind' => 'expense',
            'account_id' => test()->account->id,
            'category_id' => test()->groceries->id,
            'amount' => '80',
            'concept' => 'Gimnasio',
            'frequency' => 'monthly',
            'starts_on' => '2026-11-15',
            ...$overrides,
        ])->assertSessionHasNoErrors();

        return RecurringRule::latest('id')->firstOrFail();
    }

    test('it creates planned forecasts within the horizon that do not touch the balance', function () {
        $rule = createRule();

        $dates = $rule->transactions()->orderBy('occurrence_on')->pluck('occurred_on')
            ->map(fn ($date) => CarbonImmutable::parse($date)->toDateString())->all();

        // Hoy es 11-11-2026 y el horizonte es de 62 días (hasta el 12-01-2027).
        expect($dates)->toBe(['2026-11-15', '2026-12-15'])
            ->and($rule->transactions()->where('status', TransactionStatus::Confirmed)->count())->toBe(0)
            ->and(balance($this->account))->toBe(100000);
    });

    test('generation is idempotent', function () {
        $rule = createRule();
        $count = $rule->transactions()->count();

        app(RecurringGenerator::class)->generate($rule->refresh());
        $this->artisan('app:generate-recurring')->assertSuccessful();
        $this->artisan('app:generate-recurring')->assertSuccessful();

        expect($rule->transactions()->count())->toBe($count);
    });

    test('new occurrences appear as time passes', function () {
        $rule = createRule();
        $before = $rule->transactions()->count();

        $this->travelTo(CarbonImmutable::parse('2027-02-01 10:00', 'Europe/Madrid'));
        $this->artisan('app:generate-recurring')->assertSuccessful();

        expect($rule->transactions()->count())->toBeGreaterThan($before);
    });

    test('month-end dates do not drift', function () {
        $start = CarbonImmutable::parse('2026-01-31');

        expect(Frequency::Monthly->occurrence($start, 1)->toDateString())->toBe('2026-02-28')
            ->and(Frequency::Monthly->occurrence($start, 2)->toDateString())->toBe('2026-03-31');
    });

    test('confirmed forecasts are kept when the rule changes', function () {
        $rule = createRule();
        $first = $rule->transactions()->orderBy('occurrence_on')->firstOrFail();

        $this->actingAs($this->user)->post(route('transactions.confirm', $first))->assertSessionHasNoErrors();

        $this->actingAs($this->user)->put(route('recurring.update', $rule), [
            'account_id' => $this->account->id,
            'category_id' => $this->groceries->id,
            'amount' => '95',
            'concept' => 'Gimnasio',
            'frequency' => 'monthly',
            'starts_on' => '2026-11-15',
        ])->assertSessionHasNoErrors();

        expect($first->fresh())
            ->status->toBe(TransactionStatus::Confirmed)
            ->amount->toBe(8000)
            ->and($rule->transactions()->where('status', 'planned')->pluck('amount')->unique()->all())->toBe([9500]);
    });

    test('pausing removes pending forecasts and resuming brings them back', function () {
        $rule = createRule();

        $this->actingAs($this->user)->post(route('recurring.pause', $rule))->assertSessionHasNoErrors();
        expect($rule->transactions()->count())->toBe(0);

        $this->actingAs($this->user)->post(route('recurring.resume', $rule))->assertSessionHasNoErrors();
        expect($rule->transactions()->count())->toBeGreaterThan(0);
    });

    test('the category must match the type and the end cannot precede the start', function () {
        $this->actingAs($this->user)->post(route('recurring.store'), [
            'kind' => 'income', 'account_id' => $this->account->id, 'category_id' => $this->groceries->id,
            'amount' => '10', 'concept' => 'x', 'frequency' => 'monthly', 'starts_on' => '2026-11-15',
        ])->assertSessionHasErrors('category_id');

        $this->actingAs($this->user)->post(route('recurring.store'), [
            'kind' => 'expense', 'account_id' => $this->account->id, 'category_id' => $this->groceries->id,
            'amount' => '10', 'concept' => 'x', 'frequency' => 'monthly', 'starts_on' => '2026-11-15', 'ends_on' => '2026-11-01',
        ])->assertSessionHasErrors('ends_on');
    });

    test('upcoming commitments include forecasts and debt installments', function () {
        createRule();
        createDebt();

        $this->actingAs($this->user)
            ->get(route('recurring.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('finance/recurring/index')
                ->has('rules', 1)
                ->where('upcoming.0.concept', 'Gimnasio')
                ->where('upcoming.0.date', '2026-11-15')
                ->where('upcoming', fn ($items) => collect($items)->contains('type', 'debt')));
    });
});

describe('budgets', function () {
    test('the report compares the limit with realized and planned spending', function () {
        $this->actingAs($this->user)
            ->put(route('budgets.upsert', $this->groceries), ['amount' => '300'])
            ->assertSessionHasNoErrors();

        Transaction::factory()->for($this->account)->create(['category_id' => $this->groceries->id, 'amount' => 25000, 'occurred_on' => '2026-11-05']);
        Transaction::factory()->for($this->account)->planned()->create(['category_id' => $this->groceries->id, 'amount' => 10000, 'occurred_on' => '2026-11-20']);
        Transaction::factory()->for($this->account)->create(['category_id' => $this->groceries->id, 'amount' => 99900, 'occurred_on' => '2026-10-05']);

        $this->actingAs($this->user)
            ->get(route('budgets.index', ['month' => '2026-11']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('finance/budgets/index')
                ->where('rows', fn ($rows) => collect($rows)->contains(fn ($row) => $row['category']['name'] === 'Comida'
                    && $row['limit'] === '300.00'
                    && $row['spent'] === '250.00'
                    && $row['planned'] === '100.00'
                    && $row['remaining'] === '-50.00'
                    && $row['percent'] === 83
                    && $row['status'] === 'over_planned')));
    });

    test('budgets only apply to expense categories and can be removed', function () {
        $this->actingAs($this->user)
            ->put(route('budgets.upsert', $this->salary), ['amount' => '100'])
            ->assertSessionHasErrors('amount');

        $this->actingAs($this->user)->put(route('budgets.upsert', $this->groceries), ['amount' => '100']);
        $this->actingAs($this->user)->put(route('budgets.upsert', $this->groceries), ['amount' => '150']);
        expect(Budget::count())->toBe(1)->and(Budget::first()->amount)->toBe(15000);

        $this->actingAs($this->user)->delete(route('budgets.destroy', $this->groceries))->assertSessionHasNoErrors();
        expect(Budget::count())->toBe(0);
    });
});

describe('savings goals', function () {
    test('contributions are reservations that do not move money', function () {
        $this->actingAs($this->user)->post(route('goals.store'), [
            'name' => 'Vacaciones', 'target_amount' => '1000', 'icon' => 'plane', 'color' => 'sky',
        ])->assertSessionHasNoErrors();
        $goal = SavingsGoal::firstOrFail();

        $this->actingAs($this->user)->post(route('goals.contribute', $goal), [
            'direction' => 'deposit', 'amount' => '600', 'contributed_on' => '2026-11-10',
        ])->assertSessionHasNoErrors();

        expect($goal->savedAmount())->toBe(60000)
            ->and(balance($this->account))->toBe(100000)
            ->and($goal->refresh()->achieved_at)->toBeNull();

        $this->actingAs($this->user)->post(route('goals.contribute', $goal), [
            'direction' => 'deposit', 'amount' => '400', 'contributed_on' => '2026-11-11',
        ]);
        expect($goal->refresh()->achieved_at)->not->toBeNull();
    });

    test('you cannot withdraw more than what is reserved', function () {
        $this->actingAs($this->user)->post(route('goals.store'), [
            'name' => 'Colchón', 'target_amount' => '500', 'icon' => 'piggy-bank', 'color' => 'teal',
        ]);
        $goal = SavingsGoal::firstOrFail();

        $this->actingAs($this->user)->post(route('goals.contribute', $goal), [
            'direction' => 'deposit', 'amount' => '100', 'contributed_on' => '2026-11-10',
        ]);

        $this->actingAs($this->user)->post(route('goals.contribute', $goal), [
            'direction' => 'withdraw', 'amount' => '150', 'contributed_on' => '2026-11-10',
        ])->assertSessionHasErrors('amount');

        expect($goal->savedAmount())->toBe(10000);
    });
});

test('planning resources of other users are not reachable', function () {
    $debt = createDebt();
    $goal = SavingsGoal::forceCreate(['user_id' => $this->user->id, 'name' => 'X', 'target_amount' => 100, 'currency' => 'EUR']);
    $this->actingAs($this->user)->post(route('recurring.store'), [
        'kind' => 'expense', 'account_id' => $this->account->id, 'category_id' => $this->groceries->id,
        'amount' => '10', 'concept' => 'x', 'frequency' => 'monthly', 'starts_on' => '2026-11-15',
    ]);
    $rule = RecurringRule::firstOrFail();

    $intruder = User::factory()->superuser()->create();
    $this->actingAs($intruder);

    $this->post(route('debts.payments.store', $debt), ['account_id' => 1, 'paid_on' => '2026-11-10', 'principal' => '1'])->assertNotFound();
    $this->post(route('recurring.pause', $rule))->assertNotFound();
    $this->delete(route('recurring.destroy', $rule))->assertNotFound();
    $this->put(route('budgets.upsert', $this->groceries), ['amount' => '1'])->assertNotFound();
    $this->post(route('goals.contribute', $goal), ['direction' => 'deposit', 'amount' => '1', 'contributed_on' => '2026-11-10'])->assertNotFound();

    $this->get(route('debts.index'))->assertInertia(fn (Assert $page) => $page->has('debts', 0));
    $this->get(route('recurring.index'))->assertInertia(fn (Assert $page) => $page->has('rules', 0)->has('upcoming', 0));
    $this->get(route('goals.index'))->assertInertia(fn (Assert $page) => $page->has('goals', 0));
});
