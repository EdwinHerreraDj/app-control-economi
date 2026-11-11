<?php

use App\Actions\Users\EnsureSuperuserRemains;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\UserInvitation;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Notification::fake();
    $this->admin = User::factory()->superuser()->create(['name' => 'Admin']);
});

test('the superuser sees the user list without financial data', function () {
    User::factory()->count(3)->create();

    $this->actingAs($this->admin)
        ->get(route('admin.users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/users/index')
            ->has('users.data', 4)
            ->has('users.data.0', fn (Assert $user) => $user
                ->hasAll(['id', 'name', 'email', 'role', 'status', 'email_verified', 'invited_at', 'activated_at', 'created_at', 'is_current'])));
});

test('the list can be searched by name or email', function () {
    User::factory()->create(['name' => 'Lucía Pérez']);
    User::factory()->create(['name' => 'Otro', 'email' => 'lucia@example.com']);
    User::factory()->create(['name' => 'Nadie']);

    $this->actingAs($this->admin)
        ->get(route('admin.users.index', ['search' => 'luc']))
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 2));
});

test('inviting a user creates a pending account and emails a link', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.users.store'), [
            'name' => ' Ana ',
            'email' => 'ANA@Example.com',
            'role' => 'user',
        ])
        ->assertSessionHasNoErrors();

    $user = User::where('email', 'ana@example.com')->firstOrFail();

    expect($user->name)->toBe('Ana')
        ->and($user->status)->toBe(UserStatus::Pending)
        ->and($user->role)->toBe(UserRole::User)
        ->and($user->password)->toBeNull();

    Notification::assertSentTo($user, UserInvitation::class);
    expect(AuditLog::where('action', 'user.created')->where('actor_id', $this->admin->id)->exists())->toBeTrue();
});

test('duplicate emails are rejected', function () {
    User::factory()->create(['email' => 'ana@example.com']);

    $this->actingAs($this->admin)
        ->post(route('admin.users.store'), ['name' => 'Ana', 'email' => 'Ana@example.com', 'role' => 'user'])
        ->assertSessionHasErrors('email');
});

test('a user can be edited and promoted', function () {
    $user = User::factory()->create();

    $this->actingAs($this->admin)
        ->patch(route('admin.users.update', $user), [
            'name' => 'Nombre nuevo',
            'email' => $user->email,
            'role' => 'superuser',
        ])
        ->assertSessionHasNoErrors();

    expect($user->fresh())
        ->name->toBe('Nombre nuevo')
        ->role->toBe(UserRole::Superuser);
});

test('changing the email of an active user requires verifying it again', function () {
    $user = User::factory()->create();

    $this->actingAs($this->admin)
        ->patch(route('admin.users.update', $user), [
            'name' => $user->name,
            'email' => 'nuevo@example.com',
            'role' => 'user',
        ])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->email_verified_at)->toBeNull();
});

test('the superuser cannot change their own role', function () {
    $other = User::factory()->superuser()->create();

    $this->actingAs($this->admin)
        ->patch(route('admin.users.update', $this->admin), [
            'name' => 'Admin',
            'email' => $this->admin->email,
            'role' => 'user',
        ])
        ->assertSessionHasErrors('role');

    expect($this->admin->fresh()->role)->toBe(UserRole::Superuser)
        ->and($other->fresh()->role)->toBe(UserRole::Superuser);
});

test('the superuser cannot suspend their own account', function () {
    User::factory()->superuser()->create();

    $this->actingAs($this->admin)
        ->post(route('admin.users.suspend', $this->admin))
        ->assertSessionHasErrors('user');

    expect($this->admin->fresh()->status)->toBe(UserStatus::Active);
});

test('another superuser can be demoted or suspended while one stays active', function () {
    $second = User::factory()->superuser()->create();
    $third = User::factory()->superuser()->create();

    $this->actingAs($this->admin)
        ->patch(route('admin.users.update', $second), [
            'name' => $second->name,
            'email' => $second->email,
            'role' => 'user',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->post(route('admin.users.suspend', $third))
        ->assertSessionHasNoErrors();

    expect(User::query()->activeSuperusers()->pluck('id')->all())->toBe([$this->admin->id]);
});

test('the last active superuser is never demoted or suspended', function () {
    // Un superusuario suspendido no cuenta como superusuario activo.
    User::factory()->superuser()->suspended()->create();

    expect(fn () => app(EnsureSuperuserRemains::class)->check($this->admin))
        ->toThrow(ValidationException::class);

    $regular = User::factory()->create();
    app(EnsureSuperuserRemains::class)->check($regular); // no aplica a usuarios normales

    expect($this->admin->fresh())
        ->role->toBe(UserRole::Superuser)
        ->status->toBe(UserStatus::Active);
});

test('suspending a user revokes access and can be undone', function () {
    $user = User::factory()->create();
    $rememberToken = $user->remember_token;

    $this->actingAs($this->admin)
        ->post(route('admin.users.suspend', $user))
        ->assertSessionHasNoErrors();

    $user->refresh();
    expect($user->status)->toBe(UserStatus::Suspended)
        ->and($user->remember_token)->not->toBe($rememberToken);

    $this->actingAs($this->admin)
        ->post(route('admin.users.reactivate', $user))
        ->assertSessionHasNoErrors();

    expect($user->fresh()->status)->toBe(UserStatus::Active);
});

test('reactivating a suspended invitee returns it to pending', function () {
    $user = User::factory()->pending()->create();

    $this->actingAs($this->admin)->post(route('admin.users.suspend', $user));
    $this->actingAs($this->admin)->post(route('admin.users.reactivate', $user));

    expect($user->fresh()->status)->toBe(UserStatus::Pending);
});

test('a password reset link can be sent to active users only', function () {
    $active = User::factory()->create();
    $pending = User::factory()->pending()->create();

    $this->actingAs($this->admin)
        ->post(route('admin.users.password-reset', $active))
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($active, ResetPassword::class);

    $this->actingAs($this->admin)
        ->post(route('admin.users.password-reset', $pending))
        ->assertSessionHasErrors('user');
});

test('invitations can only be resent to pending users', function () {
    $active = User::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('admin.users.invitation', $active))
        ->assertSessionHasErrors('user');

    Notification::assertNothingSentTo($active);
});

test('administrative actions are listed in the audit log', function () {
    $user = User::factory()->create();
    $this->actingAs($this->admin)->post(route('admin.users.suspend', $user));

    $this->actingAs($this->admin)
        ->get(route('admin.audit.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/audit/index')
            ->where('logs.data.0.action', 'user.suspended')
            ->where('logs.data.0.actor', 'Admin')
            ->where('logs.data.0.subject', $user->name));
});
