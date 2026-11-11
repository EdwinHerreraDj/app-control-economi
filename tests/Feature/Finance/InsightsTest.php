<?php

use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Finance\FinancialInsights;
use App\Finance\LiquidityForecast;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\SavingsContribution;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-11 10:00', 'Europe/Madrid'));

    $this->user = User::factory()->create(['currency' => 'EUR', 'timezone' => 'Europe/Madrid']);
    $this->account = Account::factory()->for($this->user)->create(['initial_balance' => 100000]); // 1.000 €
    $this->food = Category::factory()->for($this->user)->create(['name' => 'Comida']);
    $this->salary = Category::factory()->for($this->user)->income()->create(['name' => 'Nómina']);
});

function plan(string $kind, int $amount, string $date, ?Account $account = null): Transaction
{
    return Transaction::factory()->for($account ?? test()->account)->planned()->create([
        'kind' => TransactionKind::from($kind),
        'amount' => $amount,
        'occurred_on' => $date,
        'category_id' => $kind === 'income' ? test()->salary->id : test()->food->id,
    ]);
}

function forecast(int $days = 30): ?array
{
    return app(LiquidityForecast::class)->forUser(test()->user->refresh(), $days);
}

test('without accounts there is no forecast and the home page invites to start', function () {
    $user = User::factory()->create();
    $insights = app(FinancialInsights::class);

    expect(app(LiquidityForecast::class)->forUser($user))->toBeNull()
        ->and($insights->headline($user, null, $insights->dataQuality($user))['tone'])->toBe('unknown')
        ->and($insights->savingsCapacity($user)['amount'])->toBeNull();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('needsSetup', true)
            ->where('overview.available', '0.00')
            ->where('overview.accounts', []));
});

test('the forecast adds planned income, subtracts planned payments and finds the lowest point', function () {
    plan('expense', 150000, '2026-11-20');  // −1.500 €
    plan('income', 200000, '2026-11-28');   // +2.000 €
    plan('expense', 999999, '2027-03-01');  // fuera del horizonte

    $result = forecast();

    expect($result['real'])->toBe('1000.00')
        ->and($result['planned_income'])->toBe('2000.00')
        ->and($result['planned_expense'])->toBe('1500.00')
        ->and($result['projected'])->toBe('1500.00')
        ->and($result['lowest'])->toBe('-500.00')
        ->and($result['lowest_on'])->toBe('2026-11-20')
        ->and($result['shortfall'])->toBe('500.00')
        ->and($result['assumptions'])->not->toBeEmpty();
});

test('overdue planned movements count as today and are explained', function () {
    plan('expense', 30000, '2026-11-01');

    $result = forecast();

    expect($result['overdue'])->toBe(1)
        ->and($result['timeline'][1]['date'] ?? $result['timeline'][0]['date'])->toBe('2026-11-11')
        ->and(collect($result['assumptions'])->contains(fn ($text) => str_contains($text, 'fecha pasada')))->toBeTrue();
});

test('confirmed, voided and transfer movements are not counted twice', function () {
    Transaction::factory()->for($this->account)->create(['amount' => 10000, 'category_id' => $this->food->id]); // ya en el saldo
    $voided = plan('expense', 50000, '2026-11-15');
    $voided->update(['voided_at' => now(), 'void_reason' => 'x']);

    expect(forecast()['projected'])->toBe('900.00');
});

test('debt installments are subtracted unless the same payment is already planned', function () {
    $debt = Debt::forceCreate([
        'user_id' => $this->user->id, 'creditor' => 'Banco', 'concept' => 'Préstamo', 'currency' => 'EUR',
        'principal' => 500000, 'started_on' => '2026-01-01', 'installment' => 20000,
        'frequency' => Frequency::Monthly, 'next_due_on' => '2026-11-25',
    ]);

    expect(forecast()['installments'])->toBe('200.00')
        ->and(forecast()['projected'])->toBe('800.00');

    // El usuario también lo registró como gasto previsto: se cuenta una vez.
    plan('expense', 20000, '2026-11-26');

    expect(forecast()['installments'])->toBe('0.00')
        ->and(forecast()['projected'])->toBe('800.00');
});

test('the shortfall message is exact and calm', function () {
    plan('expense', 108500, '2026-11-20');

    $insights = app(FinancialInsights::class);
    $headline = $insights->headline($this->user, forecast(), $insights->dataQuality($this->user));

    expect($headline['tone'])->toBe('support')
        ->and($headline['text'])->toContain('se prevé que falten 85,00')
        ->toContain('20 de noviembre')
        ->toContain('Puedes revisar los próximos vencimientos');
});

test('having more income than expenses alone does not mean there is margin', function () {
    // Ingresos del mes superiores a los gastos, pero un pago grande antes del cobro.
    Transaction::factory()->for($this->account)->income()->create(['amount' => 300000, 'occurred_on' => '2026-11-02', 'category_id' => $this->salary->id]);
    Transaction::factory()->for($this->account)->create(['amount' => 100000, 'occurred_on' => '2026-11-03', 'category_id' => $this->food->id]);
    plan('expense', 290000, '2026-11-15');

    $savings = app(FinancialInsights::class)->savingsCapacity($this->user);

    // El mes deja +2.000 € (3.000 − 1.000), pero tras el pago previsto el saldo
    // baja a 100 €: ese es el margen real, no la diferencia del mes.
    expect($savings['amount'])->toBe('100.00')
        ->and($savings['has_margin'])->toBeTrue();
});

test('savings capacity discounts goal reservations and remaining budgets once', function () {
    $goal = SavingsGoal::forceCreate(['user_id' => $this->user->id, 'name' => 'Viaje', 'target_amount' => 100000, 'currency' => 'EUR']);
    SavingsContribution::forceCreate(['user_id' => $this->user->id, 'savings_goal_id' => $goal->id, 'amount' => 20000, 'currency' => 'EUR', 'contributed_on' => '2026-11-01']);

    Budget::forceCreate(['user_id' => $this->user->id, 'category_id' => $this->food->id, 'amount' => 30000, 'currency' => 'EUR']);
    Transaction::factory()->for($this->account)->create(['amount' => 10000, 'occurred_on' => '2026-11-05', 'category_id' => $this->food->id]);
    plan('expense', 5000, '2026-11-20');

    // Saldo 900 €, mínimo previsto 850 €, reserva 200 €, presupuesto restante 300 − 100 − 50 = 150 €.
    $savings = app(FinancialInsights::class)->savingsCapacity($this->user);

    expect($savings['amount'])->toBe('500.00')
        ->and($savings['explanation'])->toHaveCount(3);
});

test('without budgets the estimate warns that it may be optimistic', function () {
    $savings = app(FinancialInsights::class)->savingsCapacity($this->user);

    expect(collect($savings['explanation'])->contains(fn ($text) => str_contains($text, 'optimista')))->toBeTrue();
});

test('monthly totals exclude transfers and debt principal but include interest', function () {
    $other = Account::factory()->for($this->user)->create();
    Transaction::factory()->for($this->account)->income()->create(['amount' => 100000, 'occurred_on' => '2026-11-02', 'category_id' => $this->salary->id]);
    Transaction::factory()->for($this->account)->create(['amount' => 30000, 'occurred_on' => '2026-11-03', 'category_id' => $this->food->id]);
    Transaction::factory()->for($this->account)->create(['kind' => TransactionKind::TransferOut, 'amount' => 50000, 'occurred_on' => '2026-11-04']);
    Transaction::factory()->for($other)->create(['kind' => TransactionKind::TransferIn, 'amount' => 50000, 'occurred_on' => '2026-11-04']);
    Transaction::factory()->for($this->account)->create(['kind' => TransactionKind::DebtIn, 'amount' => 900000, 'occurred_on' => '2026-11-05']);
    Transaction::factory()->for($this->account)->create(['kind' => TransactionKind::DebtOut, 'amount' => 20000, 'occurred_on' => '2026-11-06']);

    $months = app(FinancialInsights::class)->monthlyTotals($this->user, 2);

    expect($months)->toHaveCount(2)
        ->and($months[1])->toBe(['month' => '2026-11', 'income' => '1000.00', 'expense' => '300.00', 'net' => '700.00'])
        ->and($months[0]['month'])->toBe('2026-10');
});

test('category breakdown and period comparison', function () {
    $rent = Category::factory()->for($this->user)->create(['name' => 'Vivienda']);
    Transaction::factory()->for($this->account)->create(['amount' => 75000, 'occurred_on' => '2026-11-01', 'category_id' => $rent->id]);
    Transaction::factory()->for($this->account)->create(['amount' => 25000, 'occurred_on' => '2026-11-02', 'category_id' => $this->food->id]);
    Transaction::factory()->for($this->account)->create(['amount' => 20000, 'occurred_on' => '2026-10-02', 'category_id' => $this->food->id]);

    $insights = app(FinancialInsights::class);
    $breakdown = $insights->categoryBreakdown($this->user, CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-30'));

    expect($breakdown['total'])->toBe('1000.00')
        ->and($breakdown['rows'][0]['category']['name'])->toBe('Vivienda')
        ->and($breakdown['rows'][0]['share'])->toBe(75.0);

    $comparison = $insights->comparison($this->user, CarbonImmutable::parse('2026-11-01'));
    expect($comparison[0]['expense'])->toBe('1000.00')
        ->and($comparison[1]['expense'])->toBe('200.00')
        ->and($comparison[2]['has_data'])->toBeFalse();
});

test('the statistics page renders every section and explains the data', function () {
    $this->actingAs($this->user)
        ->get(route('statistics', ['months' => 3, 'days' => 90]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/statistics/index')
            ->where('filters.months', 3)
            ->where('filters.days', 90)
            ->has('evolution', 3)
            ->has('comparison', 3)
            ->has('forecast.assumptions')
            ->has('savings.explanation')
            ->has('quality'));
});

test('insights never include other users data', function () {
    $other = User::factory()->create(['currency' => 'EUR']);
    $otherAccount = Account::factory()->for($other)->create(['initial_balance' => 99999900]);
    Transaction::factory()->for($otherAccount)->planned()->create(['amount' => 5000000, 'occurred_on' => '2026-11-20']);

    expect(forecast()['real'])->toBe('1000.00')
        ->and(forecast()['projected'])->toBe('1000.00');
});
