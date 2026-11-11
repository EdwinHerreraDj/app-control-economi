<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BrandingController;
use App\Http\Controllers\Admin\MascotController as AdminMascotController;
use App\Http\Controllers\Admin\MascotMessageController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Auth\ChoosePasswordController;
use App\Http\Controllers\Auth\InvitationController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Finance\AccountController;
use App\Http\Controllers\Finance\BudgetController;
use App\Http\Controllers\Finance\CategoryController;
use App\Http\Controllers\Finance\DebtController;
use App\Http\Controllers\Finance\RecurringRuleController;
use App\Http\Controllers\Finance\SavingsGoalController;
use App\Http\Controllers\Finance\StatisticsController;
use App\Http\Controllers\Finance\TransactionController;
use App\Http\Controllers\Finance\TransferController;
use App\Http\Controllers\ManifestController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\ServiceWorkerController;
use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

// La aplicación es privada: la raíz lleva al panel (o al login si no hay sesión).
Route::redirect('/', '/dashboard')->name('home');

// Manifiesto de la PWA (público: el navegador lo pide antes de iniciar sesión).
Route::get('manifest.webmanifest', ManifestController::class)->name('manifest');

// Service worker y modo sin conexión. La página sin conexión no lleva datos:
// los lee del almacenamiento del dispositivo.
Route::get('sw.js', ServiceWorkerController::class)->name('service-worker');
Route::inertia('offline', 'offline')->name('offline');

// Sincronización del modo sin conexión (JSON).
Route::middleware(['auth', 'verified', 'onboarded'])->prefix('sync')->name('sync.')->group(function () {
    Route::get('snapshot', [SyncController::class, 'snapshot'])->middleware('throttle:30,1')->name('snapshot');
    Route::post('operations', [SyncController::class, 'push'])->middleware('throttle:30,1')->name('push');
});

Route::middleware('guest')->group(function () {
    Route::get('invitation/{token}', [InvitationController::class, 'show'])->name('invitation.show');
    Route::post('invitation', [InvitationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('invitation.store');
});

// Cambio obligatorio de la contraseña temporal puesta por el superusuario.
Route::middleware('auth')->group(function () {
    Route::get('choose-password', [ChoosePasswordController::class, 'show'])->name('password.choose');
    Route::post('choose-password', [ChoosePasswordController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('password.choose.store');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('welcome', [OnboardingController::class, 'show'])->name('onboarding.show');
    Route::post('welcome', [OnboardingController::class, 'store'])->name('onboarding.store');
});

Route::middleware(['auth', 'verified', 'onboarded'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::get('statistics', StatisticsController::class)->name('statistics');

    // Finanzas personales. Los modelos se resuelven solo entre los del
    // usuario con sesión (BelongsToUser): un id ajeno responde 404.
    Route::get('accounts', [AccountController::class, 'index'])->name('accounts.index');
    Route::post('accounts', [AccountController::class, 'store'])->name('accounts.store');
    Route::put('accounts/{account}', [AccountController::class, 'update'])->name('accounts.update');
    Route::post('accounts/{account}/archive', [AccountController::class, 'archive'])->name('accounts.archive');
    Route::post('accounts/{account}/restore', [AccountController::class, 'restore'])->name('accounts.restore');

    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::post('categories', [CategoryController::class, 'store'])->name('categories.store');
    Route::put('categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::post('categories/{category}/archive', [CategoryController::class, 'archive'])->name('categories.archive');
    Route::post('categories/{category}/restore', [CategoryController::class, 'restore'])->name('categories.restore');

    Route::get('transactions', [TransactionController::class, 'index'])->name('transactions.index');
    Route::post('transactions', [TransactionController::class, 'store'])->name('transactions.store');
    Route::put('transactions/{transaction}', [TransactionController::class, 'update'])->name('transactions.update');
    Route::post('transactions/{transaction}/confirm', [TransactionController::class, 'confirm'])->name('transactions.confirm');
    Route::post('transactions/{transaction}/void', [TransactionController::class, 'void'])->name('transactions.void');

    Route::post('transfers', [TransferController::class, 'store'])->name('transfers.store');
    Route::put('transfers/{transfer}', [TransferController::class, 'update'])->name('transfers.update');
    Route::post('transfers/{transfer}/confirm', [TransferController::class, 'confirm'])->name('transfers.confirm');
    Route::post('transfers/{transfer}/void', [TransferController::class, 'void'])->name('transfers.void');

    Route::get('debts', [DebtController::class, 'index'])->name('debts.index');
    Route::post('debts', [DebtController::class, 'store'])->name('debts.store');
    Route::put('debts/{debt}', [DebtController::class, 'update'])->name('debts.update');
    Route::post('debts/{debt}/payments', [DebtController::class, 'storePayment'])->name('debts.payments.store');
    Route::post('debt-payments/{payment}/void', [DebtController::class, 'voidPayment'])->name('debts.payments.void');

    Route::get('recurring', [RecurringRuleController::class, 'index'])->name('recurring.index');
    Route::post('recurring', [RecurringRuleController::class, 'store'])->name('recurring.store');
    Route::put('recurring/{rule}', [RecurringRuleController::class, 'update'])->name('recurring.update');
    Route::post('recurring/{rule}/pause', [RecurringRuleController::class, 'pause'])->name('recurring.pause');
    Route::post('recurring/{rule}/resume', [RecurringRuleController::class, 'resume'])->name('recurring.resume');
    Route::delete('recurring/{rule}', [RecurringRuleController::class, 'destroy'])->name('recurring.destroy');

    Route::get('budgets', [BudgetController::class, 'index'])->name('budgets.index');
    Route::put('budgets/{category}', [BudgetController::class, 'upsert'])->name('budgets.upsert');
    Route::delete('budgets/{category}', [BudgetController::class, 'destroy'])->name('budgets.destroy');

    Route::get('goals', [SavingsGoalController::class, 'index'])->name('goals.index');
    Route::post('goals', [SavingsGoalController::class, 'store'])->name('goals.store');
    Route::put('goals/{goal}', [SavingsGoalController::class, 'update'])->name('goals.update');
    Route::post('goals/{goal}/contributions', [SavingsGoalController::class, 'contribute'])->name('goals.contribute');
    Route::post('goals/{goal}/archive', [SavingsGoalController::class, 'archive'])->name('goals.archive');
    Route::post('goals/{goal}/restore', [SavingsGoalController::class, 'restore'])->name('goals.restore');
});

Route::middleware(['auth', 'verified', 'onboarded', 'can:administer'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::post('users/{user}/suspend', [UserController::class, 'suspend'])->name('users.suspend');
        Route::post('users/{user}/reactivate', [UserController::class, 'reactivate'])->name('users.reactivate');
        Route::post('users/{user}/invitation', [UserController::class, 'resendInvitation'])
            ->middleware('throttle:6,1')
            ->name('users.invitation');
        Route::put('users/{user}/temporary-password', [UserController::class, 'setTemporaryPassword'])
            ->middleware('throttle:6,1')
            ->name('users.temporary-password');
        Route::post('users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])
            ->middleware('throttle:6,1')
            ->name('users.password-reset');

        Route::get('audit', [AuditLogController::class, 'index'])->name('audit.index');

        Route::get('branding', [BrandingController::class, 'edit'])->name('branding.edit');
        Route::put('branding', [BrandingController::class, 'update'])->name('branding.update');
        Route::post('branding/assets/{asset}', [BrandingController::class, 'upload'])->name('branding.upload');
        Route::delete('branding/assets/{asset}', [BrandingController::class, 'reset'])->name('branding.reset');

        Route::get('mascots', [AdminMascotController::class, 'index'])->name('mascots.index');
        Route::post('mascots', [AdminMascotController::class, 'store'])->name('mascots.store');
        Route::get('mascots/{mascot}', [AdminMascotController::class, 'show'])->name('mascots.show');
        Route::put('mascots/{mascot}', [AdminMascotController::class, 'update'])->name('mascots.update');
        Route::post('mascots/{mascot}/assets/{state}', [AdminMascotController::class, 'uploadAsset'])->name('mascots.assets.upload');
        Route::delete('mascots/{mascot}/assets/{state}', [AdminMascotController::class, 'removeAsset'])->name('mascots.assets.remove');
        Route::post('mascots/{mascot}/publish', [AdminMascotController::class, 'publish'])->name('mascots.publish');
        Route::post('mascots/{mascot}/archive', [AdminMascotController::class, 'archive'])->name('mascots.archive');
        Route::post('mascots/{mascot}/default', [AdminMascotController::class, 'makeDefault'])->name('mascots.default');

        Route::post('mascot-messages', [MascotMessageController::class, 'store'])->name('mascot-messages.store');
        Route::put('mascot-messages/{message}', [MascotMessageController::class, 'update'])->name('mascot-messages.update');
        Route::delete('mascot-messages/{message}', [MascotMessageController::class, 'destroy'])->name('mascot-messages.destroy');
    });

require __DIR__.'/settings.php';
