<?php

use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\UserInvitation;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Invita a un usuario desde la administración y devuelve el token enviado.
 */
function inviteAndCaptureToken(string $email = 'ana@example.com'): array
{
    Notification::fake();

    $admin = User::factory()->superuser()->create();

    test()->actingAs($admin)
        ->post(route('admin.users.store'), ['mode' => 'invite', 'name' => 'Ana', 'email' => $email, 'role' => 'user'])
        ->assertSessionHasNoErrors();

    auth()->logout();

    $user = User::where('email', $email)->firstOrFail();
    $token = null;

    Notification::assertSentTo($user, UserInvitation::class, function (UserInvitation $notification) use (&$token) {
        $token = $notification->token;

        return true;
    });

    return [$user, $token];
}

test('the invitation page is shown for a valid link', function () {
    [$user, $token] = inviteAndCaptureToken();

    $this->get(route('invitation.show', ['token' => $token, 'email' => $user->email]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/accept-invitation')
            ->where('valid', true)
            ->where('name', 'Ana'));
});

test('an invalid link is reported without revealing the account', function () {
    [$user] = inviteAndCaptureToken();

    $this->get(route('invitation.show', ['token' => 'not-a-token', 'email' => $user->email]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('valid', false)
            ->where('name', null));
});

test('accepting the invitation activates, verifies and logs the user in', function () {
    [$user, $token] = inviteAndCaptureToken();

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'una-clave-segura',
        'password_confirmation' => 'una-clave-segura',
    ])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user->fresh());

    $user->refresh();
    expect($user->status)->toBe(UserStatus::Active)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->activated_at)->not->toBeNull();
});

test('an invitation link can only be used once', function () {
    [$user, $token] = inviteAndCaptureToken();

    $payload = [
        'token' => $token,
        'email' => $user->email,
        'password' => 'una-clave-segura',
        'password_confirmation' => 'una-clave-segura',
    ];

    $this->post(route('invitation.store'), $payload)->assertRedirect(route('dashboard'));
    auth()->logout();

    $this->post(route('invitation.store'), [...$payload, 'password' => 'otra-clave-1', 'password_confirmation' => 'otra-clave-1'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('an expired invitation cannot be used', function () {
    [$user, $token] = inviteAndCaptureToken();

    $this->travel(73)->hours();

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'una-clave-segura',
        'password_confirmation' => 'una-clave-segura',
    ])->assertSessionHasErrors('email');

    expect($user->fresh()->status)->toBe(UserStatus::Pending);
});

test('resending an invitation invalidates the previous link', function () {
    [$user, $oldToken] = inviteAndCaptureToken();

    $admin = User::factory()->superuser()->create();
    $this->actingAs($admin)
        ->post(route('admin.users.invitation', $user))
        ->assertSessionHasNoErrors();
    auth()->logout();

    $this->post(route('invitation.store'), [
        'token' => $oldToken,
        'email' => $user->email,
        'password' => 'una-clave-segura',
        'password_confirmation' => 'una-clave-segura',
    ])->assertSessionHasErrors('email');
});

test('a suspended invitee cannot activate the account', function () {
    [$user, $token] = inviteAndCaptureToken();

    $user->forceFill(['status' => UserStatus::Suspended])->save();

    $this->post(route('invitation.store'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'una-clave-segura',
        'password_confirmation' => 'una-clave-segura',
    ])->assertSessionHasErrors('email');
});
