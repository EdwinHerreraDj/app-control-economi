<?php

use App\Enums\UserStatus;
use App\Models\User;

test('the root redirects guests to the login page', function () {
    $this->get('/')->assertRedirect('/dashboard');
    $this->get('/dashboard')->assertRedirect(route('login'));
});

test('public registration is disabled', function () {
    $this->get('/register')->assertNotFound();
    $this->post('/register', [
        'name' => 'Intruso',
        'email' => 'intruso@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();

    expect(User::count())->toBe(0);
});

test('suspended users cannot log in even with the right password', function () {
    $user = User::factory()->suspended()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('pending users cannot log in before accepting the invitation', function () {
    $user = User::factory()->pending()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => '',
    ])->assertSessionHasErrors();

    $this->assertGuest();
});

test('an open session is closed as soon as the account is suspended', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertOk();

    $user->forceFill(['status' => UserStatus::Suspended])->save();

    $this->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertSessionHas('status');

    $this->assertGuest();
});

test('regular users cannot access the administration', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('admin.users.index'))->assertForbidden();
    $this->actingAs($user)->get(route('admin.audit.index'))->assertForbidden();
    $this->actingAs($user)
        ->post(route('admin.users.store'), ['mode' => 'invite', 'name' => 'X', 'email' => 'x@example.com', 'role' => 'superuser'])
        ->assertForbidden();

    expect(User::count())->toBe(1);
});

test('the last active superuser cannot delete their own account', function () {
    $admin = User::factory()->superuser()->create();

    $this->actingAs($admin)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasErrors('password');

    expect($admin->fresh())->not->toBeNull();
});
