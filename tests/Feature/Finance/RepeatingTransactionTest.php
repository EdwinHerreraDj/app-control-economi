<?php

use App\Enums\Frequency;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Category;
use App\Models\RecurringRule;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->user = User::factory()->create(['currency' => 'EUR', 'timezone' => 'Europe/Madrid']);
    $this->account = Account::factory()->for($this->user)->create();
    $this->category = Category::factory()->for($this->user)->create(['name' => 'Vivienda']);
});

function rentPayload(array $overrides = []): array
{
    return [
        'kind' => 'expense',
        'uuid' => (string) Str::uuid(),
        'account_id' => test()->account->id,
        'category_id' => test()->category->id,
        'amount' => '850',
        'occurred_on' => test()->user->today()->toDateString(),
        'status' => 'confirmed',
        'concept' => 'Alquiler',
        'repeat' => 'monthly',
        ...$overrides,
    ];
}

test('a movement marked as repeating creates its recurrence and is its first time', function () {
    $today = $this->user->today();

    $this->actingAs($this->user)->post(route('transactions.store'), rentPayload())->assertSessionHasNoErrors();

    $rule = RecurringRule::query()->sole();
    expect($rule->frequency)->toBe(Frequency::Monthly)
        ->and($rule->starts_on->toDateString())->toBe($today->toDateString())
        ->and($rule->amount)->toBe(85000)
        ->and($rule->concept)->toBe('Alquiler');

    // Hoy hay un solo movimiento (el registrado), ya pagado y enlazado.
    $todays = Transaction::query()->whereDate('occurred_on', $today->toDateString())->get();
    expect($todays)->toHaveCount(1)
        ->and($todays->first()->status)->toBe(TransactionStatus::Confirmed)
        ->and($todays->first()->recurring_rule_id)->toBe($rule->id);

    // Las siguientes fechas quedan pendientes, el mismo día de cada mes.
    $next = Transaction::query()->where('recurring_rule_id', $rule->id)
        ->where('status', TransactionStatus::Planned->value)->orderBy('occurred_on')->first();
    expect($next)->not->toBeNull()
        ->and($next->occurred_on->toDateString())->toBe($today->addMonthsNoOverflow(1)->toDateString());
});

test('sending the same repeating movement twice does not create a second recurrence', function () {
    $payload = rentPayload();

    $this->actingAs($this->user)->post(route('transactions.store'), $payload);
    $this->actingAs($this->user)->post(route('transactions.store'), $payload);

    expect(RecurringRule::count())->toBe(1)
        ->and(Transaction::query()->whereDate('occurred_on', $payload['occurred_on'])->count())->toBe(1);
});

test('movements without repeat do not create recurrences', function () {
    $this->actingAs($this->user)->post(route('transactions.store'), rentPayload(['repeat' => null]))->assertSessionHasNoErrors();

    expect(RecurringRule::count())->toBe(0);
});

test('repeat must be a known frequency and cannot be sent when editing', function () {
    $this->actingAs($this->user)->post(route('transactions.store'), rentPayload(['repeat' => 'daily']))
        ->assertSessionHasErrors('repeat');

    $this->actingAs($this->user)->post(route('transactions.store'), rentPayload(['repeat' => null]));
    $transaction = Transaction::query()->firstOrFail();

    $this->actingAs($this->user)->put(route('transactions.update', $transaction), [
        ...rentPayload(), 'kind' => null, 'uuid' => null, 'repeat' => 'monthly',
    ])->assertSessionHasErrors('repeat');
});
