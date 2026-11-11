<?php

use App\Enums\TransactionStatus;
use App\Finance\AccountBalances;
use App\Models\Account;
use App\Models\Category;
use App\Models\SyncOperation;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['currency' => 'EUR']);
    $this->account = Account::factory()->for($this->user)->create(['name' => 'Nómina', 'initial_balance' => 100000]);
    $this->category = Category::factory()->for($this->user)->create(['name' => 'Comida']);
});

function offlineOperation(array $payload = [], array $overrides = []): array
{
    return [
        'uuid' => (string) Str::uuid(),
        'type' => 'transaction.create',
        'created_at' => now()->toIso8601String(),
        'payload' => [
            'kind' => 'expense',
            'account_id' => test()->account->id,
            'category_id' => test()->category->id,
            'amount' => '25.50',
            'occurred_on' => '2026-11-05',
            'status' => 'confirmed',
            'concept' => 'Supermercado',
            'notes' => null,
            ...$payload,
        ],
        ...$overrides,
    ];
}

function pushOperations(array $operations, ?int $userId = null)
{
    return test()->actingAs(test()->user)->postJson(route('sync.push'), [
        'user_id' => $userId ?? test()->user->id,
        'operations' => $operations,
    ]);
}

test('the snapshot contains only the user own data and is not cached', function () {
    $other = User::factory()->create();
    Account::factory()->for($other)->create(['name' => 'Cuenta ajena']);
    Transaction::factory()->for($this->user)->create([
        'account_id' => $this->account->id, 'category_id' => $this->category->id,
        'amount' => 2000, 'occurred_on' => now()->subDay()->toDateString(), 'concept' => 'Pan',
    ]);

    $response = $this->actingAs($this->user)->getJson(route('sync.snapshot'))
        ->assertOk()
        ->assertJsonPath('user.id', $this->user->id)
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('accounts.0.name', 'Nómina')
        ->assertJsonPath('recent.0.concept', 'Pan')
        ->assertJsonMissing(['name' => 'Cuenta ajena']);

    expect($response->headers->get('Cache-Control'))->toContain('no-store');
});

test('sync endpoints require a session', function () {
    $this->getJson(route('sync.snapshot'))->assertUnauthorized();
    $this->postJson(route('sync.push'), [])->assertUnauthorized();
});

test('a suspended account gets a JSON answer so the device can clear its data', function () {
    $user = User::factory()->suspended()->create();

    $this->actingAs($user)->getJson(route('sync.snapshot'))
        ->assertForbidden()
        ->assertJsonPath('code', 'inactive');

    $this->assertGuest();
});

test('an offline expense is applied and changes the balance', function () {
    $operation = offlineOperation();

    pushOperations([$operation])
        ->assertOk()
        ->assertJsonPath('results.0.status', 'applied');

    $transaction = Transaction::where('uuid', $operation['uuid'])->firstOrFail();

    expect($transaction->amount)->toBe(2550)
        ->and($transaction->user_id)->toBe($this->user->id)
        ->and($transaction->status)->toBe(TransactionStatus::Confirmed)
        ->and(app(AccountBalances::class)->forAccount($this->account))->toBe(100000 - 2550)
        ->and(SyncOperation::where('uuid', $operation['uuid'])->value('status'))->toBe('applied');
});

test('sending the same operation twice does not duplicate it', function () {
    $operation = offlineOperation();

    pushOperations([$operation])->assertJsonPath('results.0.status', 'applied');
    pushOperations([$operation])->assertJsonPath('results.0.status', 'applied');

    expect(Transaction::where('concept', 'Supermercado')->count())->toBe(1)
        ->and(SyncOperation::count())->toBe(1);
});

test('references to another user account are rejected without creating anything', function () {
    $foreign = Account::factory()->for(User::factory())->create();

    pushOperations([offlineOperation(['account_id' => $foreign->id])])
        ->assertOk()
        ->assertJsonPath('results.0.status', 'rejected')
        ->assertJsonStructure(['results' => [['errors' => ['account_id']]]]);

    expect(Transaction::count())->toBe(0);
});

test('an account archived meanwhile is reported and can be retried after fixing it', function () {
    $this->account->forceFill(['archived_at' => now()])->save();
    $operation = offlineOperation();

    pushOperations([$operation])
        ->assertJsonPath('results.0.status', 'rejected')
        ->assertJsonPath('results.0.errors.account_id.0', 'La cuenta está archivada. Restáurala para registrar movimientos en ella.');

    $other = Account::factory()->for($this->user)->create();
    $operation['payload']['account_id'] = $other->id;

    pushOperations([$operation])->assertJsonPath('results.0.status', 'applied');

    expect(Transaction::where('uuid', $operation['uuid'])->value('account_id'))->toBe($other->id)
        ->and(SyncOperation::where('uuid', $operation['uuid'])->value('attempts'))->toBe(2);
});

test('a possible duplicate needs an explicit decision', function () {
    pushOperations([offlineOperation()])->assertJsonPath('results.0.status', 'applied');

    $second = offlineOperation();

    pushOperations([$second])
        ->assertJsonPath('results.0.status', 'conflict')
        ->assertJsonPath('results.0.duplicate.concept', 'Supermercado');

    expect(Transaction::count())->toBe(1);

    pushOperations([[...$second, 'confirm_duplicate' => true]])
        ->assertJsonPath('results.0.status', 'applied');

    expect(Transaction::count())->toBe(2);
});

test('changes registered with another account are never applied to the session', function () {
    pushOperations([offlineOperation()], $this->user->id + 1000)
        ->assertStatus(409)
        ->assertJsonPath('code', 'user_mismatch');

    expect(Transaction::count())->toBe(0);
});

test('invalid amounts and unsupported operations are rejected', function () {
    pushOperations([
        offlineOperation(['amount' => '-3']),
        offlineOperation([], ['type' => 'debt.update']),
    ])
        ->assertJsonPath('results.0.status', 'rejected')
        ->assertJsonPath('results.1.status', 'rejected');

    expect(Transaction::count())->toBe(0);
});

test('batches are limited in size', function () {
    $operations = array_map(fn () => offlineOperation(), range(1, 51));

    pushOperations($operations)->assertUnprocessable();
});

test('the offline page is public and carries no personal data', function () {
    $this->get(route('offline'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('offline')
            ->where('auth.user', null));
});

test('the service worker is served from the root with the offline page', function () {
    $response = $this->get(route('service-worker'))->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('javascript')
        ->and($response->headers->get('Service-Worker-Allowed'))->toBe('/')
        ->and($response->getContent())
        ->toContain('const VERSION =')
        ->toContain("const OFFLINE_URL = '/offline'")
        ->not->toContain('/sync/');
});
