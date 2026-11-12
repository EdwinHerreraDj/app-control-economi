<?php

use App\Actions\Finance\SeedDefaultCategories;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-12 12:00:00', 'Europe/Madrid'));
    $this->user = User::factory()->create(['currency' => 'EUR', 'timezone' => 'Europe/Madrid']);
    app(SeedDefaultCategories::class)->handle($this->user);
    $this->account = Account::factory()->for($this->user)->create();
});

function movement(string $category, int $amount, string $date = '2026-11-10', array $extra = []): Transaction
{
    $user = test()->user;
    $found = $user->categories()->where('name', $category)->firstOrFail();

    return Transaction::factory()->for(test()->account)->create([
        'user_id' => $user->id,
        'category_id' => $found->id,
        'kind' => $found->kind->value === 'income' ? TransactionKind::Income : TransactionKind::Expense,
        'amount' => $amount,
        'occurred_on' => $date,
        'status' => TransactionStatus::Confirmed,
        ...$extra,
    ]);
}

test('expenses are grouped by category with every category shown', function () {
    movement('Restaurantes', 400, '2026-11-10', ['concept' => 'Cerveza']);
    movement('Restaurantes', 1800, '2026-11-11', ['concept' => 'Comida fuera']);
    movement('Alimentación', 4500, '2026-11-09', ['concept' => 'Supermercado']);
    movement('Alimentación', 9900, '2026-10-30'); // otro mes
    movement('Nómina', 140000); // es un ingreso

    $this->actingAs($this->user)->get(route('expenses.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('flows/index')
            ->where('kind', 'expense')
            ->where('month', '2026-11')
            ->where('total', '67.00')
            // Primero las que tienen movimientos, de más a menos dinero.
            ->where('groups.0.name', 'Alimentación')
            ->where('groups.0.total', '45.00')
            ->where('groups.1.name', 'Restaurantes')
            ->where('groups.1.count', 2)
            ->where('groups.1.movements.0.concept', 'Comida fuera')
            // Todas las categorías de gasto aparecen, aunque estén vacías.
            ->has('groups', $this->user->categories()->where('kind', 'expense')->count())
            ->where('groups.2.count', 0));
});

test('a new movement appears inside its category group', function () {
    $this->actingAs($this->user)->post(route('transactions.store'), [
        'kind' => 'expense', 'account_id' => $this->account->id,
        'category_id' => $this->user->categories()->where('name', 'Transporte')->value('id'),
        'amount' => '30', 'occurred_on' => '2026-11-12', 'status' => 'confirmed', 'concept' => 'Transporte',
    ])->assertSessionHasNoErrors();

    $this->get(route('expenses.index'))->assertInertia(fn (Assert $page) => $page
        ->where('groups.0.name', 'Transporte')
        ->where('groups.0.total', '30.00')
        ->where('groups.0.movements.0.concept', 'Transporte'));
});

test('incomes have their own section', function () {
    movement('Nómina', 140000, '2026-11-05', ['concept' => 'Sueldo']);
    movement('Ventas', 5000, '2026-11-07', ['concept' => 'Vendí la bici']);

    $this->actingAs($this->user)->get(route('incomes.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('kind', 'income')
            ->where('total', '1450.00')
            ->where('groups.0.name', 'Nómina')
            ->where('groups.1.name', 'Ventas'));
});

test('pending movements are shown apart from what already happened', function () {
    movement('Vivienda', 45000, '2026-11-20', ['status' => TransactionStatus::Planned, 'concept' => 'Alquiler']);

    $this->actingAs($this->user)->get(route('expenses.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('total', '0.00')
            ->where('pending', '450.00')
            ->where('groups.0.pending', '450.00'));
});

test('past months can be reviewed but future ones cannot', function () {
    movement('Alimentación', 9900, '2026-10-30');

    $this->actingAs($this->user)->get(route('expenses.index', ['month' => '2026-10']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('month', '2026-10')
            ->where('total', '99.00')
            ->where('next', '2026-11'));

    $this->get(route('expenses.index', ['month' => '2027-05']))
        ->assertInertia(fn (Assert $page) => $page->where('month', '2026-11')->where('next', null));
});

test('only the person own movements and categories are shown', function () {
    $other = User::factory()->create(['currency' => 'EUR']);
    app(SeedDefaultCategories::class)->handle($other);
    $foreignAccount = Account::factory()->for($other)->create();
    Transaction::factory()->for($foreignAccount)->create([
        'user_id' => $other->id, 'kind' => TransactionKind::Expense, 'amount' => 99999,
        'occurred_on' => '2026-11-10', 'status' => TransactionStatus::Confirmed,
        'category_id' => $other->categories()->where('name', 'Ropa')->value('id'),
    ]);

    $this->actingAs($this->user)->get(route('expenses.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('total', '0.00')
            ->where('groups', fn ($groups) => collect($groups)->every(fn ($group) => $group['count'] === 0))
            ->where('groups', fn ($groups) => collect($groups)->pluck('id')
                ->intersect($other->categories()->pluck('id'))->isEmpty()));
});
