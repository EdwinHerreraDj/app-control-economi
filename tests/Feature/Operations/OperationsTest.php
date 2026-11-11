<?php

use App\Actions\Finance\ManageAccounts;
use App\Actions\Finance\ManageDebts;
use App\Actions\Finance\RecordTransaction;
use App\Actions\Finance\RecordTransfer;
use App\Backup\BackupManager;
use App\Enums\AccountType;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Finance\IntegrityChecker;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;

beforeEach(function () {
    $this->user = User::factory()->create(['currency' => 'EUR']);
    $accounts = app(ManageAccounts::class);
    $this->main = $accounts->create($this->user, 'Nómina', AccountType::Bank, 100000);
    $this->savings = $accounts->create($this->user, 'Ahorro', AccountType::Savings, 0);
    $this->expense = Category::factory()->for($this->user)->create();

    app(RecordTransaction::class)->create($this->user, [
        'kind' => TransactionKind::Expense, 'account' => $this->main, 'category' => $this->expense,
        'amount' => 2500, 'occurred_on' => '2026-11-05', 'status' => TransactionStatus::Confirmed, 'concept' => 'Compra',
    ]);

    $this->transfer = app(RecordTransfer::class)->create($this->user, [
        'from' => $this->main, 'to' => $this->savings, 'amount' => 10000,
        'occurred_on' => '2026-11-06', 'status' => TransactionStatus::Confirmed,
    ]);

    $debts = app(ManageDebts::class);
    $debt = $debts->create($this->user, [
        'creditor' => 'Banco', 'concept' => 'Préstamo', 'principal' => 50000, 'started_on' => '2026-10-01',
        'installment' => 5000, 'frequency' => Frequency::Monthly, 'next_due_on' => '2026-12-01',
        'interest_rate' => null, 'notes' => null, 'disbursement_account' => $this->main,
    ]);
    $this->payment = $debts->recordPayment($debt, [
        'account' => $this->main, 'category' => $this->expense, 'paid_on' => '2026-11-01',
        'principal' => 4000, 'interest' => 900, 'fees' => 100, 'notes' => null, 'advances_schedule' => false,
    ]);
});

function failingChecks(): array
{
    return array_keys(array_filter(app(IntegrityChecker::class)->run(), fn ($check) => $check['ids'] !== []));
}

test('data recorded through the app passes every integrity check', function () {
    expect(failingChecks())->toBe([]);

    $this->artisan('app:check-integrity')->assertSuccessful();
});

test('integrity checks detect broken transfers, debt payments and currencies', function () {
    DB::table('transactions')->where('transfer_id', $this->transfer->id)->where('kind', 'transfer_in')->update(['amount' => 9000]);
    DB::table('transactions')->where('debt_payment_id', $this->payment->id)->where('kind', 'expense')->update(['voided_at' => now()]);
    DB::table('transactions')->where('concept', 'Compra')->update(['currency' => 'USD']);

    expect(failingChecks())->toEqualCanonicalizing(['transfer_legs', 'debt_payments', 'transaction_currency']);

    $this->artisan('app:check-integrity')->assertFailed();
});

test('a movement in another user account is reported', function () {
    $other = app(ManageAccounts::class)->create(User::factory()->create(), 'Ajena', AccountType::Bank, 0);
    Transaction::where('concept', 'Compra')->update(['account_id' => $other->id]);

    expect(failingChecks())->toContain('transaction_owner');
});

test('responses carry security headers and a nonce based content policy', function () {
    Vite::useHotFile(storage_path('framework/testing/no-hot-file'));

    $response = $this->get(route('login'))->assertOk();

    expect($response->headers->get('X-Frame-Options'))->toBe('DENY')
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('Referrer-Policy'))->toBe('strict-origin-when-cross-origin');

    $policy = (string) $response->headers->get('Content-Security-Policy');
    preg_match("/'nonce-([^']+)'/", $policy, $nonce);

    expect($policy)->toContain("default-src 'self'")->toContain("frame-ancestors 'none'")
        ->and($nonce[1] ?? null)->not->toBeNull()
        // El script en línea del tema lleva el nonce de la petición.
        ->and($response->getContent())->toContain('nonce="'.$nonce[1].'"');
});

test('backups refuse to run on a database other than MySQL', function () {
    $this->artisan('app:backup')->assertFailed();
});

test('old backups are pruned but the three most recent are always kept', function () {
    $root = storage_path('framework/testing/backups');
    File::deleteDirectory($root);
    config(['backup.path' => $root, 'backup.keep_days' => 14]);

    $names = ['20250101-030000', '20250102-030000', '20250103-030000', '20250104-030000', now()->format('Ymd').'-030000'];
    foreach ($names as $name) {
        File::ensureDirectoryExists("{$root}/{$name}");
        File::put("{$root}/{$name}/manifest.json", '{}');
    }

    $manager = app(BackupManager::class);
    $deleted = $manager->prune();

    expect($deleted)->toBe(['20250102-030000', '20250101-030000'])
        ->and($manager->list())->toBe([$names[4], '20250104-030000', '20250103-030000']);

    File::deleteDirectory($root);
});

test('the mail test command validates the address and sends a message', function () {
    $this->artisan('app:mail-test', ['email' => 'no-es-un-correo'])->assertFailed();
    $this->artisan('app:mail-test', ['email' => 'persona@example.com'])->assertSuccessful();
});
