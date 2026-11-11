<?php

use App\Actions\Finance\ManageDebts;
use App\Actions\Finance\ManageRecurringRules;
use App\Actions\Finance\ManageSavingsGoals;
use App\Actions\Finance\RecordTransfer;
use App\Actions\Finance\SeedDefaultCategories;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/*
 * Regresión: borrar un usuario con datos financieros fallaba porque las
 * cuentas están protegidas (ON DELETE RESTRICT) frente a sus movimientos.
 */
test('a user with financial data can delete their account and nothing is left behind', function () {
    $user = User::factory()->create(['currency' => 'EUR']);
    app(SeedDefaultCategories::class)->handle($user);
    $food = $user->categories()->where('kind', 'expense')->firstOrFail();
    $a = Account::factory()->for($user)->create();
    $b = Account::factory()->for($user)->create();

    Transaction::factory()->for($a)->create(['category_id' => $food->id]);
    app(RecordTransfer::class)->create($user, ['from' => $a, 'to' => $b, 'amount' => 100, 'occurred_on' => '2026-11-01', 'status' => TransactionStatus::Confirmed]);
    $debt = app(ManageDebts::class)->create($user, [
        'creditor' => 'Banco', 'concept' => 'Préstamo', 'principal' => 10000, 'started_on' => '2026-11-01',
        'installment' => null, 'frequency' => null, 'next_due_on' => null, 'interest_rate' => null, 'notes' => null,
        'disbursement_account' => $a,
    ]);
    app(ManageDebts::class)->recordPayment($debt, [
        'account' => $a, 'category' => $food, 'paid_on' => '2026-11-05', 'principal' => 1000, 'interest' => 100, 'fees' => 0,
        'notes' => null, 'advances_schedule' => false,
    ]);
    app(ManageRecurringRules::class)->create($user, [
        'kind' => TransactionKind::Expense, 'account' => $a, 'category' => $food, 'amount' => 500, 'concept' => 'x',
        'nature' => null, 'frequency' => Frequency::Monthly, 'starts_on' => '2026-11-20', 'ends_on' => null,
    ]);
    Budget::forceCreate(['user_id' => $user->id, 'category_id' => $food->id, 'amount' => 1000, 'currency' => 'EUR']);
    $goals = app(ManageSavingsGoals::class);
    $goals->contribute($goals->create($user, ['name' => 'X', 'target_amount' => 1000, 'target_date' => null, 'icon' => 'tag', 'color' => 'teal']), 100, '2026-11-01', null);

    $this->actingAs($user)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect(User::find($user->id))->toBeNull();

    foreach (['accounts', 'categories', 'transactions', 'transfers', 'debts', 'debt_payments', 'recurring_rules', 'budgets', 'savings_goals', 'savings_contributions'] as $table) {
        expect(DB::table($table)->where('user_id', $user->id)->count())->toBe(0, "Quedan filas en {$table}");
    }
});
