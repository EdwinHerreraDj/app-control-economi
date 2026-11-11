<?php

use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Notification::fake();
    $this->admin = User::factory()->superuser()->create();
});

function createWithPassword(array $overrides = []): TestResponse
{
    return test()->actingAs(test()->admin)->post(route('admin.users.store'), [
        'mode' => 'password',
        'name' => 'Pedro',
        'email' => 'pedro@example.com',
        'role' => 'user',
        'password' => 'temporal-123',
        'password_confirmation' => 'temporal-123',
        ...$overrides,
    ]);
}

test('the superuser can create an active account with a temporary password and no email is sent', function () {
    createWithPassword()->assertSessionHasNoErrors();

    $user = User::where('email', 'pedro@example.com')->firstOrFail();

    expect($user->status)->toBe(UserStatus::Active)
        ->and($user->must_change_password)->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('temporal-123', $user->password))->toBeTrue();

    Notification::assertNothingSent();

    // La auditoría registra el alta sin la contraseña.
    $log = AuditLog::where('action', 'user.created_with_password')->firstOrFail();
    expect(json_encode($log->properties))->not->toContain('temporal-123');
});

test('the temporary password is validated and must be confirmed', function () {
    createWithPassword(['password_confirmation' => 'otra'])->assertSessionHasErrors('password');
    createWithPassword(['password' => '', 'password_confirmation' => ''])->assertSessionHasErrors('password');
    createWithPassword(['mode' => 'otra-cosa'])->assertSessionHasErrors('mode');

    expect(User::where('email', 'pedro@example.com')->exists())->toBeFalse();
});

test('an invitation does not need a password', function () {
    $this->actingAs($this->admin)->post(route('admin.users.store'), [
        'mode' => 'invite', 'name' => 'Ana', 'email' => 'ana@example.com', 'role' => 'user',
    ])->assertSessionHasNoErrors();

    expect(User::where('email', 'ana@example.com')->firstOrFail()->password)->toBeNull();
});

test('after logging in with the temporary password the user must choose their own', function () {
    createWithPassword();
    auth()->logout();

    $this->post(route('login.store'), ['email' => 'pedro@example.com', 'password' => 'temporal-123']);
    $this->assertAuthenticated();

    // Cualquier pantalla lleva a elegir la contraseña.
    $this->get(route('dashboard'))->assertRedirect(route('password.choose'));
    $this->get(route('accounts.index'))->assertRedirect(route('password.choose'));
    $this->get(route('password.choose'))->assertOk();

    // No vale repetir la temporal.
    $this->post(route('password.choose.store'), ['password' => 'temporal-123', 'password_confirmation' => 'temporal-123'])
        ->assertSessionHasErrors('password');

    $this->post(route('password.choose.store'), ['password' => 'mi-clave-propia', 'password_confirmation' => 'mi-clave-propia'])
        ->assertRedirect(route('dashboard'));

    $user = User::where('email', 'pedro@example.com')->firstOrFail();
    expect($user->must_change_password)->toBeFalse()
        ->and(Hash::check('mi-clave-propia', $user->password))->toBeTrue();

    // Ya no se le redirige (pasa a la primera configuración, como cualquier usuario nuevo).
    $this->get(route('dashboard'))->assertRedirect(route('onboarding.show'));
});

test('the superuser can set a temporary password on an existing account', function () {
    $user = User::factory()->create();
    $token = $user->remember_token;

    $this->actingAs($this->admin)
        ->put(route('admin.users.temporary-password', $user), ['password' => 'nueva-temp-1', 'password_confirmation' => 'nueva-temp-1'])
        ->assertSessionHasNoErrors();

    $user->refresh();
    expect($user->must_change_password)->toBeTrue()
        ->and($user->remember_token)->not->toBe($token)
        ->and(Hash::check('nueva-temp-1', $user->password))->toBeTrue()
        ->and(AuditLog::where('action', 'user.temporary_password_set')->exists())->toBeTrue();
});

test('a pending invitee who gets a temporary password becomes active', function () {
    $user = User::factory()->pending()->create();

    $this->actingAs($this->admin)
        ->put(route('admin.users.temporary-password', $user), ['password' => 'nueva-temp-1', 'password_confirmation' => 'nueva-temp-1'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->status)->toBe(UserStatus::Active);
});

test('temporary passwords cannot be set on yourself, on suspended accounts or by regular users', function () {
    $this->actingAs($this->admin)
        ->put(route('admin.users.temporary-password', $this->admin), ['password' => 'nueva-temp-1', 'password_confirmation' => 'nueva-temp-1'])
        ->assertSessionHasErrors('password');

    $suspended = User::factory()->suspended()->create();
    $this->actingAs($this->admin)
        ->put(route('admin.users.temporary-password', $suspended), ['password' => 'nueva-temp-1', 'password_confirmation' => 'nueva-temp-1'])
        ->assertSessionHasErrors('password');

    $regular = User::factory()->create();
    $this->actingAs($regular)
        ->put(route('admin.users.temporary-password', $suspended), ['password' => 'nueva-temp-1', 'password_confirmation' => 'nueva-temp-1'])
        ->assertForbidden();
});
