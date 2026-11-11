<?php

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('it creates an active, verified superuser', function () {
    $this->artisan('app:create-superuser')
        ->expectsQuestion('Correo electrónico', 'Admin@Example.com')
        ->expectsQuestion('Nombre', 'Edwin')
        ->expectsQuestion('Contraseña', 'clave-super-segura')
        ->expectsQuestion('Repite la contraseña', 'clave-super-segura')
        ->assertSuccessful();

    $user = User::where('email', 'admin@example.com')->firstOrFail();

    expect($user->name)->toBe('Edwin')
        ->and($user->role)->toBe(UserRole::Superuser)
        ->and($user->status)->toBe(UserStatus::Active)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('clave-super-segura', $user->password))->toBeTrue()
        ->and(AuditLog::where('action', 'superuser.created')->exists())->toBeTrue();
});

test('it does nothing when the passwords do not match', function () {
    $this->artisan('app:create-superuser')
        ->expectsQuestion('Correo electrónico', 'admin@example.com')
        ->expectsQuestion('Nombre', 'Edwin')
        ->expectsQuestion('Contraseña', 'clave-super-segura')
        ->expectsQuestion('Repite la contraseña', 'otra-clave-distinta')
        ->assertFailed();

    expect(User::count())->toBe(0);
});

test('it refuses to modify an existing account without --promote', function () {
    $user = User::factory()->create(['email' => 'ana@example.com']);

    $this->artisan('app:create-superuser')
        ->expectsQuestion('Correo electrónico', 'ana@example.com')
        ->assertFailed();

    expect($user->fresh()->role)->toBe(UserRole::User);
});

test('it promotes an existing account only after explicit confirmation', function () {
    $user = User::factory()->create(['email' => 'ana@example.com']);

    $this->artisan('app:create-superuser', ['--promote' => true])
        ->expectsQuestion('Correo electrónico', 'ana@example.com')
        ->expectsConfirmation("¿Convertir a {$user->name} en superusuario?", 'no')
        ->assertSuccessful();

    expect($user->fresh()->role)->toBe(UserRole::User);

    $this->artisan('app:create-superuser', ['--promote' => true])
        ->expectsQuestion('Correo electrónico', 'ana@example.com')
        ->expectsConfirmation("¿Convertir a {$user->name} en superusuario?", 'yes')
        ->assertSuccessful();

    expect($user->fresh()->role)->toBe(UserRole::Superuser)
        ->and(AuditLog::where('action', 'superuser.promoted')->exists())->toBeTrue();
});

test('--promote fails when the account does not exist', function () {
    $this->artisan('app:create-superuser', ['--promote' => true])
        ->expectsQuestion('Correo electrónico', 'nadie@example.com')
        ->assertFailed();

    expect(User::count())->toBe(0);
});
