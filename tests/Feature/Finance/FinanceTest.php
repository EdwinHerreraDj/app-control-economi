<?php

use App\Enums\CategoryKind;
use App\Enums\TransactionStatus;
use App\Finance\AccountBalances;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use App\Support\FinancialFootprint;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['currency' => 'EUR']);
    $this->account = Account::factory()->for($this->user)->create(['name' => 'Nómina', 'initial_balance' => 100000]);
    $this->savings = Account::factory()->for($this->user)->create(['name' => 'Ahorro']);
    $this->expenseCategory = Category::factory()->for($this->user)->create(['name' => 'Comida']);
    $this->incomeCategory = Category::factory()->for($this->user)->income()->create(['name' => 'Sueldo']);
});

function expensePayload(array $overrides = []): array
{
    return [
        'kind' => 'expense',
        'account_id' => test()->account->id,
        'category_id' => test()->expenseCategory->id,
        'amount' => '25,50',
        'occurred_on' => '2026-11-05',
        'status' => 'confirmed',
        'concept' => 'Supermercado',
        ...$overrides,
    ];
}

function balanceOf(Account $account): int
{
    return app(AccountBalances::class)->forAccount($account);
}

test('completing the first setup creates default categories but no movements', function () {
    $user = User::factory()->notOnboarded()->create();

    $this->actingAs($user)->post(route('onboarding.store'), [
        'currency' => 'EUR', 'number_locale' => 'es-ES', 'timezone' => 'Europe/Madrid', 'locale' => 'es',
    ]);

    expect($user->categories()->where('kind', CategoryKind::Income)->count())->toBeGreaterThan(0)
        ->and($user->categories()->where('kind', CategoryKind::Expense)->count())->toBeGreaterThan(0)
        ->and($user->transactions()->count())->toBe(0)
        ->and($user->accounts()->count())->toBe(0);
});

test('accounts are created in the user currency and listed with their balance', function () {
    $this->actingAs($this->user)
        ->post(route('accounts.store'), ['name' => 'Cartera', 'type' => 'cash', 'initial_balance' => '-12,30'])
        ->assertSessionHasNoErrors();

    $account = Account::where('name', 'Cartera')->firstOrFail();
    expect($account->currency)->toBe('EUR')->and($account->initial_balance)->toBe(-1230);

    $this->actingAs($this->user)
        ->get(route('accounts.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/accounts/index')
            ->where('total', '987.70'));
});

test('confirmed movements change the balance and planned ones do not', function () {
    $this->actingAs($this->user)->post(route('transactions.store'), expensePayload())->assertSessionHasNoErrors();
    $this->actingAs($this->user)->post(route('transactions.store'), expensePayload(['status' => 'planned', 'amount' => '500']));
    $this->actingAs($this->user)->post(route('transactions.store'), expensePayload([
        'kind' => 'income', 'category_id' => $this->incomeCategory->id, 'amount' => '1000.01',
    ]));

    expect(balanceOf($this->account))->toBe(100000 - 2550 + 100001);
});

test('confirming a planned movement updates the balance', function () {
    $planned = Transaction::factory()->for($this->account)->planned()->create(['amount' => 3000, 'category_id' => $this->expenseCategory->id]);

    expect(balanceOf($this->account))->toBe(100000);

    $this->actingAs($this->user)->post(route('transactions.confirm', $planned))->assertSessionHasNoErrors();

    expect($planned->fresh()->status)->toBe(TransactionStatus::Confirmed)
        ->and(balanceOf($this->account))->toBe(97000);
});

test('voided movements stay in the history but stop counting', function () {
    $movement = Transaction::factory()->for($this->account)->create(['amount' => 3000, 'category_id' => $this->expenseCategory->id]);

    $this->actingAs($this->user)
        ->post(route('transactions.void', $movement), ['reason' => 'Cargo duplicado'])
        ->assertSessionHasNoErrors();

    expect($movement->fresh())
        ->voided_at->not->toBeNull()
        ->void_reason->toBe('Cargo duplicado')
        ->and(balanceOf($this->account))->toBe(100000);

    $this->actingAs($this->user)
        ->put(route('transactions.update', $movement), expensePayload(['kind' => null]))
        ->assertSessionHasErrors('transaction');
});

test('the category must match the movement type', function () {
    $this->actingAs($this->user)
        ->post(route('transactions.store'), expensePayload(['category_id' => $this->incomeCategory->id]))
        ->assertSessionHasErrors('category_id');
});

test('amounts are validated for the currency', function () {
    $this->actingAs($this->user)
        ->post(route('transactions.store'), expensePayload(['amount' => '10.999']))
        ->assertSessionHasErrors('amount');

    $this->actingAs($this->user)
        ->post(route('transactions.store'), expensePayload(['amount' => '0']))
        ->assertSessionHasErrors('amount');
});

test('archived accounts and categories cannot receive new movements', function () {
    $this->savings->forceFill(['archived_at' => now()])->save();

    $this->actingAs($this->user)
        ->post(route('transactions.store'), expensePayload(['account_id' => $this->savings->id]))
        ->assertSessionHasErrors('account_id');
});

test('sending the same uuid twice does not duplicate the movement', function () {
    $uuid = '7f9c2a4e-1b3d-4c5e-8f6a-0b1c2d3e4f50';

    $this->actingAs($this->user)->post(route('transactions.store'), expensePayload(['uuid' => $uuid]));
    $this->actingAs($this->user)->post(route('transactions.store'), expensePayload(['uuid' => $uuid]));

    expect(Transaction::where('uuid', $uuid)->count())->toBe(1);
});

test('a transfer moves money between accounts without being income or expense', function () {
    $this->actingAs($this->user)
        ->post(route('transfers.store'), [
            'from_account_id' => $this->account->id,
            'to_account_id' => $this->savings->id,
            'amount' => '200',
            'occurred_on' => '2026-11-05',
            'status' => 'confirmed',
        ])
        ->assertSessionHasNoErrors();

    $transfer = Transfer::firstOrFail();

    expect($transfer->transactions()->count())->toBe(2)
        ->and(balanceOf($this->account))->toBe(80000)
        ->and(balanceOf($this->savings))->toBe(20000);

    $this->actingAs($this->user)
        ->get(route('transactions.index', ['month' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.income', '0.00')
            ->where('summary.expense', '0.00')
            ->has('transactions.data', 1)); // la transferencia aparece una sola vez
});

test('a transfer needs two different accounts', function () {
    $this->actingAs($this->user)
        ->post(route('transfers.store'), [
            'from_account_id' => $this->account->id,
            'to_account_id' => $this->account->id,
            'amount' => '200',
            'occurred_on' => '2026-11-05',
            'status' => 'confirmed',
        ])
        ->assertSessionHasErrors('to_account_id');
});

test('editing and voiding a transfer keeps both movements consistent', function () {
    $this->actingAs($this->user)->post(route('transfers.store'), [
        'from_account_id' => $this->account->id,
        'to_account_id' => $this->savings->id,
        'amount' => '200',
        'occurred_on' => '2026-11-05',
        'status' => 'confirmed',
    ]);
    $transfer = Transfer::firstOrFail();

    $this->actingAs($this->user)->put(route('transfers.update', $transfer), [
        'from_account_id' => $this->account->id,
        'to_account_id' => $this->savings->id,
        'amount' => '50',
        'occurred_on' => '2026-11-06',
        'status' => 'confirmed',
    ])->assertSessionHasNoErrors();

    expect(balanceOf($this->account))->toBe(95000)->and(balanceOf($this->savings))->toBe(5000);

    // Un movimiento de transferencia no se edita por separado.
    $movement = $transfer->transactions()->first();
    $this->actingAs($this->user)
        ->post(route('transactions.void', $movement), ['reason' => 'x'])
        ->assertSessionHasErrors('transaction');

    $this->actingAs($this->user)
        ->post(route('transfers.void', $transfer), ['reason' => 'Error'])
        ->assertSessionHasNoErrors();

    expect(balanceOf($this->account))->toBe(100000)
        ->and(balanceOf($this->savings))->toBe(0)
        ->and($transfer->transactions()->whereNull('voided_at')->count())->toBe(0);
});

test('the month summary only counts confirmed income and expenses of that month', function () {
    Transaction::factory()->for($this->account)->income()->create(['amount' => 200000, 'occurred_on' => '2026-11-01', 'category_id' => $this->incomeCategory->id]);
    Transaction::factory()->for($this->account)->create(['amount' => 5000, 'occurred_on' => '2026-11-10', 'category_id' => $this->expenseCategory->id]);
    Transaction::factory()->for($this->account)->planned()->create(['amount' => 7000, 'occurred_on' => '2026-11-20', 'category_id' => $this->expenseCategory->id]);
    Transaction::factory()->for($this->account)->create(['amount' => 9999, 'occurred_on' => '2026-10-31', 'category_id' => $this->expenseCategory->id]);

    $this->actingAs($this->user)
        ->get(route('transactions.index', ['month' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.income', '2000.00')
            ->where('summary.expense', '50.00')
            ->where('summary.planned_expense', '70.00')
            ->has('transactions.data', 3));
});

test('an account can only be archived with a zero balance', function () {
    $this->actingAs($this->user)
        ->post(route('accounts.archive', $this->account))
        ->assertSessionHasErrors('account');

    $this->actingAs($this->user)
        ->post(route('accounts.archive', $this->savings))
        ->assertSessionHasNoErrors();

    expect($this->savings->fresh()->isArchived())->toBeTrue();
});

test('categories can be created, renamed and archived but never change type', function () {
    $this->actingAs($this->user)
        ->post(route('categories.store'), ['kind' => 'expense', 'name' => 'Mascotas', 'icon' => 'dog', 'color' => 'amber'])
        ->assertSessionHasNoErrors();

    $category = Category::where('name', 'Mascotas')->firstOrFail();

    $this->actingAs($this->user)
        ->put(route('categories.update', $category), ['kind' => 'income', 'name' => 'Perro', 'icon' => 'dog', 'color' => 'amber'])
        ->assertSessionHasErrors('kind');

    $this->actingAs($this->user)
        ->put(route('categories.update', $category), ['name' => 'Perro', 'icon' => 'dog', 'color' => 'amber'])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->user)
        ->post(route('categories.store'), ['kind' => 'expense', 'name' => 'Perro', 'icon' => 'tag', 'color' => 'teal'])
        ->assertSessionHasErrors('name');

    $this->actingAs($this->user)->post(route('categories.archive', $category))->assertSessionHasNoErrors();
    expect($category->fresh()->isArchived())->toBeTrue();
});

test('the currency is locked once the user has an account', function () {
    expect(app(FinancialFootprint::class)->hasRecords($this->user))->toBeTrue();
    expect(app(FinancialFootprint::class)->hasRecords(User::factory()->create()))->toBeFalse();
});

describe('isolation between users', function () {
    beforeEach(function () {
        $this->intruder = User::factory()->superuser()->create();
        $this->movement = Transaction::factory()->for($this->account)->create(['category_id' => $this->expenseCategory->id]);
    });

    test('foreign resources respond as if they did not exist', function () {
        $this->actingAs($this->intruder);

        $this->put(route('accounts.update', $this->account), ['name' => 'X', 'type' => 'bank', 'initial_balance' => '0'])->assertNotFound();
        $this->post(route('accounts.archive', $this->savings))->assertNotFound();
        $this->put(route('categories.update', $this->expenseCategory), ['name' => 'X', 'icon' => 'tag', 'color' => 'teal'])->assertNotFound();
        $this->post(route('transactions.void', $this->movement), ['reason' => 'x'])->assertNotFound();
        $this->post(route('transactions.confirm', $this->movement))->assertNotFound();

        expect($this->account->fresh()->name)->toBe('Nómina')
            ->and($this->movement->fresh()->voided_at)->toBeNull();
    });

    test('foreign accounts and categories cannot be used in new movements', function () {
        Account::factory()->for($this->intruder)->create();
        $this->intruder->forceFill(['currency' => 'EUR'])->save();

        $this->actingAs($this->intruder)
            ->post(route('transactions.store'), expensePayload())
            ->assertSessionHasErrors(['account_id', 'category_id']);

        $this->actingAs($this->intruder)
            ->post(route('transfers.store'), [
                'from_account_id' => $this->account->id,
                'to_account_id' => $this->savings->id,
                'amount' => '1',
                'occurred_on' => '2026-11-05',
                'status' => 'confirmed',
            ])
            ->assertSessionHasErrors(['from_account_id', 'to_account_id']);

        expect(Transaction::count())->toBe(1);
    });

    test('listings never include other users data', function () {
        $this->actingAs($this->intruder)
            ->get(route('transactions.index', ['month' => now()->format('Y-m')]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('transactions.data', 0)
                ->has('accounts', 0)
                ->has('categories', 0)
                ->where('summary.expense', '0.00'));

        $this->actingAs($this->intruder)
            ->get(route('accounts.index'))
            ->assertInertia(fn (Assert $page) => $page->has('accounts', 0));

        $this->actingAs($this->intruder)
            ->get(route('categories.index'))
            ->assertInertia(fn (Assert $page) => $page->has('categories', 0));
    });

    test('filtering by a foreign account id returns nothing', function () {
        $this->actingAs($this->intruder)
            ->get(route('transactions.index', ['account' => $this->account->id, 'month' => now()->format('Y-m')]))
            ->assertInertia(fn (Assert $page) => $page->has('transactions.data', 0));
    });
});
