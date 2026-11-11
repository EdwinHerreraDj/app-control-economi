<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

test('security page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->has('passwordRules')
            ->has('sessions'));
});

test('password can be updated', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('security.edit'));

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue();
});

test('correct password must be provided to update password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasErrors('current_password')
        ->assertRedirect(route('security.edit'));
});

test('other devices can be logged out with the current password', function () {
    $user = User::factory()->create();
    $originalHash = $user->password;

    $this->actingAs($user)
        ->from(route('security.edit'))
        ->delete(route('sessions.destroy-others'), ['password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('security.edit'));

    // Rehashear la contraseña invalida las sesiones y cookies de recuerdo
    // de los demás dispositivos (AuthenticateSession).
    expect($user->refresh()->password)->not->toBe($originalHash)
        ->and(Hash::check('password', $user->password))->toBeTrue()
        ->and(AuditLog::where('action', 'user.other_sessions_closed')->exists())->toBeTrue();
});

test('logging out other devices requires the correct password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('security.edit'))
        ->delete(route('sessions.destroy-others'), ['password' => 'wrong'])
        ->assertSessionHasErrors('password');
});

test('a session with an outdated password hash is logged out', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertOk();

    // Otro dispositivo cambia la contraseña: esta sesión ya no es válida.
    $user->forceFill(['password' => 'changed-elsewhere'])->save();
    Auth::forgetUser();

    $this->get(route('dashboard'))->assertRedirect(route('login'));
    $this->assertGuest();
});
