<?php

use App\Actions\Finance\SeedDefaultCategories;
use App\Enums\AccountType;
use App\Enums\CategoryKind;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Finance\CategoryGuesser;
use App\Finance\MoneyOverview;
use App\Finance\MonthSummary;
use App\Finance\Notices;
use App\Finance\RecurringGenerator;
use App\Models\Account;
use App\Models\Debt;
use App\Models\RecurringRule;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-11 12:00:00', 'Europe/Madrid'));
    $this->user = User::factory()->create(['currency' => 'EUR', 'timezone' => 'Europe/Madrid']);
    app(SeedDefaultCategories::class)->handle($this->user);
});

function overview(): array
{
    return app(MoneyOverview::class)->forUser(test()->user);
}

function spend(array $overrides = []): void
{
    test()->actingAs(test()->user)->post(route('transactions.store'), [
        'kind' => 'expense',
        'uuid' => (string) Str::uuid(),
        'account_id' => Account::query()->where('user_id', test()->user->id)->where('type', '!=', 'savings')->value('id'),
        'category_id' => test()->user->categories()->where('name', 'Restaurantes')->value('id'),
        'amount' => '4',
        'occurred_on' => '2026-11-11',
        'status' => 'confirmed',
        'concept' => 'Una cerveza con un amigo',
        ...$overrides,
    ])->assertSessionHasNoErrors();
}

function pendingOf(string $concept): Transaction
{
    return Transaction::query()->where('user_id', test()->user->id)
        ->where('concept', $concept)->where('status', 'planned')->orderBy('occurred_on')->firstOrFail();
}

/**
 * Criterio de éxito: cobró 1.400 €, pagó 450 € de alquiler, se tomó una
 * cerveza de 4 € y debe 300 € de un portátil.
 */
test('the everyday story adds up without explanations', function () {
    $this->actingAs($this->user);

    $this->post(route('setup.money'), ['bank' => '0'])->assertSessionHasNoErrors()->assertRedirect(route('setup.show', ['paso' => 'ingresos']));
    expect(Account::count())->toBe(1);
    $this->post(route('setup.incomes'), ['items' => [
        ['concept' => 'Sueldo', 'amount' => '1400', 'frequency' => 'monthly', 'next_on' => '2026-11-11'],
    ]])->assertSessionHasNoErrors();
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Alquiler', 'amount' => '450', 'frequency' => 'monthly', 'next_on' => '2026-11-11'],
    ]])->assertSessionHasNoErrors();
    $this->post(route('setup.debts'), ['items' => [
        ['concept' => 'Portátil', 'total' => '300', 'installment' => '50', 'frequency' => 'monthly', 'next_due_on' => '2026-12-01'],
    ]])->assertSessionHasNoErrors();
    $this->post(route('setup.finish'))->assertRedirect(route('dashboard'));

    // Lo previsto no cuenta todavía.
    expect(overview()['available'])->toBe('0.00')
        ->and(overview()['upcoming']['incomes'][0]['concept'])->toBe('Sueldo')
        ->and(overview()['upcoming']['payments'][0]['concept'])->toBe('Alquiler');

    $this->post(route('transactions.confirm', pendingOf('Sueldo')))->assertSessionHasNoErrors();
    $this->post(route('transactions.confirm', pendingOf('Alquiler')))->assertSessionHasNoErrors();
    spend();

    $summary = overview();

    expect($summary['available'])->toBe('946.00')             // 1.400 − 450 − 4
        ->and($summary['month']['received'])->toBe('1400.00')
        ->and($summary['month']['spent'])->toBe('454.00')
        ->and($summary['debts']['owed'])->toBe('300.00')
        ->and($summary['upcoming']['installments'][0])->toMatchArray([
            'concept' => 'Portátil', 'amount' => '50.00', 'date' => '2026-12-01',
        ]);

    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->component('dashboard')
        ->where('needsSetup', false)
        ->where('overview.available', '946.00'));
});

test('planned income and payments never change the money you have until confirmed', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '200']);
    $this->post(route('setup.incomes'), ['items' => [
        ['concept' => 'Sueldo', 'amount' => '1400', 'frequency' => 'monthly', 'next_on' => '2026-11-20'],
    ]]);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Luz', 'amount' => '60', 'frequency' => 'monthly', 'next_on' => '2026-11-25', 'variable' => true],
    ]]);

    $summary = overview();

    expect($summary['available'])->toBe('200.00')
        ->and($summary['end_of_month']['estimate'])->toBe('1540.00') // estimación, aparte
        ->and($summary['upcoming']['payments'][0]['variable'])->toBeTrue();
});

test('a variable payment is confirmed with its real amount and is not generated again', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '500']);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Luz', 'amount' => '60', 'frequency' => 'monthly', 'next_on' => '2026-11-12', 'variable' => true],
    ]]);

    // Se pagó un día antes de lo previsto y costó más de lo habitual.
    $light = Transaction::query()->where('concept', 'Luz')->orderBy('occurred_on')->firstOrFail();

    $this->post(route('transactions.confirm', $light), ['amount' => '73,40', 'occurred_on' => '2026-11-11'])
        ->assertSessionHasNoErrors();

    $light->refresh();
    expect($light->status)->toBe(TransactionStatus::Confirmed)
        ->and($light->amount)->toBe(7340)
        ->and($light->occurred_on->toDateString())->toBe('2026-11-11');

    // La tarea programada no vuelve a crear la del día 12 ni duplica nada.
    $rule = RecurringRule::query()->sole();
    app(RecurringGenerator::class)->generate($rule);
    app(RecurringGenerator::class)->generate($rule);

    expect(Transaction::query()->where('recurring_rule_id', $rule->id)->whereDate('occurrence_on', '2026-11-12')->count())->toBe(1)
        ->and(overview()['available'])->toBe('426.60');
});

test('payments on day 31 fall on the last day of short months and keep going', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '0']);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Seguro', 'amount' => '20', 'frequency' => 'monthly', 'next_on' => '2026-12-31'],
    ]]);

    $this->travelTo(CarbonImmutable::parse('2027-03-01 09:00:00', 'Europe/Madrid'));
    app(RecurringGenerator::class)->generate(RecurringRule::query()->sole());

    $dates = Transaction::query()->where('concept', 'Seguro')->orderBy('occurred_on')->pluck('occurred_on')
        ->map(fn ($date) => CarbonImmutable::parse($date)->toDateString())->all();

    expect($dates)->toContain('2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30');
});

test('savings are kept apart: moving money is not spending', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000', 'savings' => '300']);

    $bank = Account::query()->where('type', AccountType::Bank->value)->sole();
    $savings = Account::query()->where('type', AccountType::Savings->value)->sole();

    $this->post(route('transfers.store'), [
        'from_account_id' => $bank->id, 'to_account_id' => $savings->id, 'amount' => '200',
        'occurred_on' => '2026-11-11', 'status' => 'confirmed', 'concept' => 'Guardado en ahorros',
    ])->assertSessionHasNoErrors();

    $summary = overview();

    expect($summary['available'])->toBe('800.00')
        ->and($summary['saved'])->toBe('500.00')
        ->and($summary['month']['spent'])->toBe('0.00')
        ->and($summary['month']['received'])->toBe('0.00');
});

test('debts count what was paid before and recalculate with real payments', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000']);
    $this->post(route('setup.debts'), ['items' => [
        ['concept' => 'Portátil', 'total' => '600', 'installment' => '50', 'frequency' => 'monthly',
            'paid_installments' => 4, 'next_due_on' => '2026-11-15'],
    ]])->assertSessionHasNoErrors();

    $debt = Debt::query()->sole();
    expect($debt->paid_before)->toBe(20000)
        ->and($debt->outstanding())->toBe(40000)
        ->and(overview()['available'])->toBe('1000.00'); // apuntarla no mueve dinero

    $account = Account::query()->sole();
    $pay = fn (string $amount, ?string $interest = null) => $this->post(route('debts.payments.store', $debt), [
        'uuid' => (string) Str::uuid(), 'account_id' => $account->id,
        'category_id' => $interest ? $this->user->categories()->where('name', 'Comisiones e intereses')->value('id') : null,
        'paid_on' => '2026-11-11', 'principal' => $amount, 'interest' => $interest, 'advances_schedule' => true,
    ]);

    // Cuota con intereses: los intereses son gasto, pero no se cuentan dos veces.
    $pay('50', '2')->assertSessionHasNoErrors();
    $summary = overview();
    expect($debt->fresh()->outstanding())->toBe(35000)
        ->and($debt->fresh()->next_due_on->toDateString())->toBe('2026-12-15')
        ->and($summary['available'])->toBe('948.00')
        ->and($summary['month']['spent'])->toBe('0.00')
        ->and($summary['month']['debt_paid'])->toBe('52.00');

    // Pago parcial y anticipado.
    $pay('20')->assertSessionHasNoErrors();
    expect($debt->fresh()->outstanding())->toBe(33000);

    // Nunca por debajo de cero.
    $pay('400')->assertSessionHasErrors('principal');

    $pay('330')->assertSessionHasNoErrors();
    expect($debt->fresh()->isSettled())->toBeTrue()
        ->and($debt->fresh()->outstanding())->toBe(0)
        ->and(overview()['debts']['owed'])->toBe('0.00');
});

test('what was already paid cannot exceed the debt', function () {
    $this->actingAs($this->user)->post(route('setup.debts'), ['items' => [
        ['concept' => 'Préstamo de Juan', 'total' => '100', 'installment' => '50', 'paid_installments' => 3],
    ]])->assertSessionHasErrors('items.0.paid_amount');

    expect(Debt::count())->toBe(0);
});

test('a debt without installments (a friend) is fine', function () {
    $this->actingAs($this->user)->post(route('setup.debts'), ['items' => [
        ['concept' => 'Préstamo de Juan', 'total' => '80', 'creditor' => 'Juan'],
    ]])->assertSessionHasNoErrors();

    $debt = Debt::query()->sole();
    expect($debt->installment)->toBeNull()
        ->and($debt->next_due_on)->toBeNull()
        ->and($debt->outstanding())->toBe(8000);
});

test('each month only counts what happened in it, once', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000']);

    // Apuntado hoy, pero ocurrió el mes pasado.
    spend(['occurred_on' => '2026-10-30', 'amount' => '30', 'concept' => 'Cena']);
    spend(['amount' => '12', 'concept' => 'Una crema', 'spending_type' => 'treat']);

    $months = app(MonthSummary::class);
    $october = $months->forMonth($this->user, CarbonImmutable::parse('2026-10-01'));
    $november = $months->forMonth($this->user, CarbonImmutable::parse('2026-11-01'));

    expect($october['spent'])->toBe('30.00')
        ->and($november['spent'])->toBe('12.00')
        ->and($november['treats'])->toBe('12.00')
        ->and($november['result'])->toBe('-12.00')
        ->and(collect($november['movements'])->pluck('concept')->all())->toBe(['Una crema']);
});

test('the change of year keeps December and January apart', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000']);
    spend(['occurred_on' => '2026-12-31', 'amount' => '10', 'concept' => 'Nochevieja']);
    spend(['occurred_on' => '2027-01-01', 'amount' => '7', 'concept' => 'Año nuevo']);

    $this->travelTo(CarbonImmutable::parse('2027-01-05 10:00:00', 'Europe/Madrid'));
    $months = app(MonthSummary::class);

    expect($months->forMonth($this->user, CarbonImmutable::parse('2026-12-01'))['spent'])->toBe('10.00')
        ->and($months->forMonth($this->user, CarbonImmutable::parse('2027-01-01'))['spent'])->toBe('7.00');

    $this->get(route('months.index', ['month' => '2026-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('months/index')
            ->where('summary.month', '2026-12')
            ->where('next', '2027-01')
            ->where('previous', '2026-11'));
});

test('deleting a movement updates the money and skipping a habitual payment is permanent', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '100']);
    spend(['amount' => '40', 'concept' => 'Ropa']);
    expect(overview()['available'])->toBe('60.00');

    $this->delete(route('transactions.destroy', Transaction::query()->where('concept', 'Ropa')->sole()))
        ->assertSessionHasNoErrors();
    expect(overview()['available'])->toBe('100.00')
        ->and(Transaction::query()->where('concept', 'Ropa')->exists())->toBeFalse();

    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Gimnasio', 'amount' => '25', 'frequency' => 'monthly', 'next_on' => '2026-11-20'],
    ]]);
    $gym = pendingOf('Gimnasio');
    $this->delete(route('transactions.destroy', $gym))->assertSessionHasNoErrors();

    app(RecurringGenerator::class)->generate(RecurringRule::query()->sole());

    expect($gym->fresh()->voided_at)->not->toBeNull()
        ->and(Transaction::query()->where('concept', 'Gimnasio')->whereNull('voided_at')->whereDate('occurred_on', '2026-11-20')->exists())->toBeFalse();
});

test('editing a movement recalculates everything', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '100']);
    spend(['amount' => '10', 'concept' => 'Supermercado']);
    $movement = Transaction::query()->where('concept', 'Supermercado')->sole();

    $this->put(route('transactions.update', $movement), [
        'account_id' => $movement->account_id, 'category_id' => $movement->category_id,
        'amount' => '25,50', 'occurred_on' => '2026-11-11', 'status' => 'confirmed', 'concept' => 'Supermercado',
    ])->assertSessionHasNoErrors();

    expect(overview()['available'])->toBe('74.50')
        ->and(overview()['month']['spent'])->toBe('25.50');
});

test('the category is suggested from what the person writes', function () {
    $guesser = app(CategoryGuesser::class);

    expect($guesser->guess($this->user, CategoryKind::Expense, 'Me tomé una cerveza')?->name)->toBe('Restaurantes')
        ->and($guesser->guess($this->user, CategoryKind::Expense, 'Gasolina')?->name)->toBe('Transporte')
        ->and($guesser->guess($this->user, CategoryKind::Income, 'Me pagaron el sueldo')?->name)->toBe('Nómina')
        ->and($guesser->guess($this->user, CategoryKind::Expense, 'xyz'))->toBeNull();
});

test('notices use real data and never more than three', function () {
    // Se apuntan dos días antes: el pago del día 10 queda atrasado.
    $this->travelTo(CarbonImmutable::parse('2026-11-09 12:00:00', 'Europe/Madrid'));
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '100']);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Alquiler', 'amount' => '450', 'frequency' => 'monthly', 'next_on' => '2026-11-12'],
        ['concept' => 'Internet', 'amount' => '30', 'frequency' => 'monthly', 'next_on' => '2026-11-10'],
    ]]);
    $this->post(route('setup.debts'), ['items' => [
        ['concept' => 'Portátil', 'total' => '300', 'installment' => '50', 'paid_installments' => 3, 'next_due_on' => '2026-12-15'],
    ]]);
    $this->travelTo(CarbonImmutable::parse('2026-11-11 12:00:00', 'Europe/Madrid'));

    // El formato pone un espacio de no separación antes de «€».
    $texts = collect(app(Notices::class)->forUser($this->user))->pluck('text')->map(fn (string $text) => str_replace("\u{00A0}", ' ', $text));

    expect($texts)->toHaveCount(3)
        ->and($texts[0])->toBe('Tienes un pago pendiente desde ayer: Internet, 30,00 €.')
        ->and($texts[1])->toBe('Mañana te toca pagar Alquiler (450,00 €).')
        ->and($texts[2])->toBe('Te quedan 3 cuotas de Portátil.');
});

test('the quick forms and pages only show the person own data', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '100']);

    $other = User::factory()->create(['currency' => 'EUR']);
    app(SeedDefaultCategories::class)->handle($other);
    $foreign = Account::factory()->for($other)->create(['name' => 'Cuenta ajena']);
    $foreignPending = Transaction::factory()->for($foreign)->create([
        'user_id' => $other->id, 'status' => TransactionStatus::Planned, 'kind' => TransactionKind::Expense,
        'concept' => 'Pago ajeno', 'occurred_on' => '2026-11-12',
        'category_id' => $other->categories()->where('kind', 'expense')->value('id'),
    ]);

    $data = $this->getJson(route('quick-add.data'))->assertOk()->json();

    expect(collect($data['accounts'])->pluck('name')->all())->toBe(['Banco'])
        ->and(collect($data['pending'])->pluck('concept')->all())->not->toContain('Pago ajeno')
        ->and(collect($data['categories'])->pluck('id')->intersect($other->categories()->pluck('id'))->all())->toBe([]);

    $this->post(route('transactions.confirm', $foreignPending))->assertNotFound();
    $this->delete(route('transactions.destroy', $foreignPending))->assertNotFound();

    $this->get(route('payments.index'))->assertInertia(fn (Assert $page) => $page
        ->component('payments/index')
        ->where('upcoming.payments', []));
});

test('every setup question can be skipped', function () {
    $this->actingAs($this->user)
        ->post(route('setup.finish'))
        ->assertRedirect(route('dashboard'));

    expect($this->user->fresh()->hasCompletedSetup())->toBeTrue();
    $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('needsSetup', false));
});

test('the money step creates the accounts once and never touches existing ones', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1200,50', 'cash' => '40', 'savings' => '3000']);

    expect(Account::query()->orderBy('id')->get()->map(fn ($a) => [$a->name, $a->type->value, $a->initial_balance])->all())
        ->toBe([['Banco', 'bank', 120050], ['Efectivo', 'cash', 4000], ['Ahorros', 'savings', 300000]]);

    $this->post(route('setup.money'), ['bank' => '5', 'cash' => '5', 'savings' => '5']);
    expect(Account::count())->toBe(3)
        ->and(Account::query()->where('name', 'Banco')->value('initial_balance'))->toBe(120050);
});

test('amounts are stored as exact cents', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '0']);

    spend(['amount' => '0.10', 'concept' => 'Chicle 1']);
    spend(['amount' => '0.20', 'concept' => 'Chicle 2']);

    // 0,1 + 0,2 con decimales flotantes da 0,30000000000000004.
    expect(overview()['available'])->toBe('-0.30')
        ->and(overview()['month']['spent'])->toBe('0.30');
});

test('people who already have accounts are not asked to start over', function () {
    Account::factory()->for($this->user)->create();

    $this->actingAs($this->user)->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('needsSetup', false));
});

test('the home shows the expected spending until the end of the month', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '500']);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Luz', 'amount' => '60', 'frequency' => 'monthly', 'next_on' => '2026-11-20'],
        ['concept' => 'Seguro', 'amount' => '200', 'frequency' => 'monthly', 'next_on' => '2026-12-02'], // ya es diciembre
    ]]);
    $this->post(route('setup.debts'), ['items' => [
        ['concept' => 'Portátil', 'total' => '300', 'installment' => '50', 'next_due_on' => '2026-11-25'],
    ]]);
    spend(['amount' => '10', 'concept' => 'Café']);

    $outlook = overview()['month_outlook'];

    expect($outlook['spent'])->toBe('10.00')
        ->and($outlook['pending_payments'])->toBe('60.00')
        ->and($outlook['pending_installments'])->toBe('50.00')
        ->and($outlook['total'])->toBe('120.00')
        // Lo previsto no se descuenta del dinero disponible.
        ->and(overview()['available'])->toBe('490.00');
});

test('the home shows everything to pay next month, debts included', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000']);
    $this->post(route('setup.incomes'), ['items' => [
        // La nómina llega el día 1: cubre el mes entero.
        ['concept' => 'Sueldo', 'amount' => '1400', 'frequency' => 'monthly', 'next_on' => '2026-12-01'],
    ]]);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Alquiler', 'amount' => '450', 'frequency' => 'monthly', 'next_on' => '2026-11-30'],
    ]]);
    $this->post(route('setup.debts'), ['items' => [
        // Cuota de noviembre y la siguiente, en diciembre.
        ['concept' => 'Portátil', 'total' => '300', 'installment' => '50', 'frequency' => 'monthly', 'next_due_on' => '2026-11-15'],
        // Solo le quedan 30 € tras la cuota de noviembre: la de diciembre es de 30.
        ['concept' => 'Móvil', 'total' => '100', 'installment' => '70', 'frequency' => 'monthly', 'next_due_on' => '2026-11-20'],
    ]]);

    $next = overview()['next_cycle'];

    expect($next['start'])->toBe('2026-12-01')
        ->and($next['end'])->toBe('2026-12-31')
        ->and($next['payday'])->toBe('2026-12-01')
        ->and($next['in_progress'])->toBeFalse()
        ->and($next['payments'])->toBe('450.00')
        ->and($next['installments'])->toBe('80.00')
        ->and($next['total'])->toBe('530.00')
        ->and($next['incomes'])->toBe('1400.00')
        ->and($next['free'])->toBe('870.00')
        ->and(collect($next['items'])->pluck('concept')->all())->toBe(['Portátil', 'Móvil', 'Alquiler']);

    // Este mes también cuentan las cuotas de noviembre.
    expect(overview()['month_outlook']['pending_installments'])->toBe('120.00');

    // Hasta la nómina hay que cubrir el alquiler de noviembre y dos cuotas.
    expect(overview()['until_payday'])->toMatchArray([
        'until' => '2026-11-30', 'payments' => '450.00', 'installments' => '120.00',
        'to_pay' => '570.00', 'left' => '430.00',
    ]);
});

test('a debt with an installment but no date counts every month until it is paid', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000']);
    $this->post(route('setup.debts'), ['items' => [
        ['concept' => 'Préstamo de Juan', 'total' => '200', 'installment' => '40'],
    ]]);

    expect(overview()['month_outlook']['pending_installments'])->toBe('40.00')
        ->and(overview()['next_cycle']['installments'])->toBe('40.00')
        ->and(overview()['next_cycle']['items'][0]['date'])->toBeNull();

    // Pagada la de este mes, ya no queda pendiente en noviembre.
    $debt = Debt::query()->sole();
    $this->post(route('debts.payments.store', $debt), [
        'uuid' => (string) Str::uuid(), 'account_id' => Account::query()->value('id'),
        'paid_on' => '2026-11-11', 'principal' => '40', 'advances_schedule' => true,
    ])->assertSessionHasNoErrors();

    expect(overview()['month_outlook']['pending_installments'])->toBe('0.00')
        ->and(overview()['next_cycle']['installments'])->toBe('40.00');
});

test('weekly installments count as many times as they fall in the month', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '1000']);
    $this->post(route('setup.debts'), ['items' => [
        ['concept' => 'Tele', 'total' => '1000', 'installment' => '10', 'frequency' => 'weekly', 'next_due_on' => '2026-11-12'],
    ]]);

    // Diciembre de 2026: jueves 3, 10, 17, 24 y 31.
    expect(overview()['next_cycle']['installments'])->toBe('50.00')
        ->and(collect(overview()['next_cycle']['items'])->pluck('date')->all())
        ->toBe(['2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31']);
});

test('a salary late in the month covers until the next one', function () {
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '300']);
    $this->post(route('setup.incomes'), ['items' => [
        ['concept' => 'Nómina', 'amount' => '1500', 'frequency' => 'monthly', 'next_on' => '2026-11-25'],
    ]]);
    $this->post(route('setup.payments'), ['items' => [
        ['concept' => 'Internet', 'amount' => '30', 'frequency' => 'monthly', 'next_on' => '2026-11-20'],
        ['concept' => 'Alquiler', 'amount' => '450', 'frequency' => 'monthly', 'next_on' => '2026-12-01'],
    ]]);

    $summary = overview();

    expect($summary['next_cycle'])->toMatchArray([
        // Alquiler del 1 de diciembre e internet del 20 de diciembre.
        'start' => '2026-11-25', 'end' => '2026-12-24', 'incomes' => '1500.00', 'payments' => '480.00',
    ])
        ->and($summary['until_payday'])->toMatchArray(['until' => '2026-11-24', 'to_pay' => '30.00', 'left' => '270.00']);
});

test('between the 1st and payday the current month is the one being covered', function () {
    $this->travelTo(CarbonImmutable::parse('2026-12-03 10:00:00', 'Europe/Madrid'));
    $this->actingAs($this->user)->post(route('setup.money'), ['bank' => '100']);
    $this->post(route('setup.incomes'), ['items' => [
        ['concept' => 'Nómina', 'amount' => '1400', 'frequency' => 'monthly', 'next_on' => '2026-12-05'],
    ]]);

    $summary = overview();

    expect($summary['until_payday'])->toBeNull()
        ->and($summary['next_cycle'])->toMatchArray([
            'start' => '2026-12-01', 'end' => '2026-12-31', 'in_progress' => true, 'incomes' => '1400.00',
        ]);
});
