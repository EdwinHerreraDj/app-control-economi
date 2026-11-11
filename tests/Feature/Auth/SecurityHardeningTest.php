<?php

use App\Actions\Users\InviteUser;
use App\Models\User;
use App\Notifications\AccountChangedByAdministrator;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

test('password recovery answers the same whether or not the account exists', function () {
    Notification::fake();
    $user = User::factory()->create();

    $known = $this->post(route('password.email'), ['email' => $user->email]);
    $unknown = $this->post(route('password.email'), ['email' => 'nadie@example.com']);

    $known->assertSessionHasNoErrors()->assertSessionHas('status');
    $unknown->assertSessionHasNoErrors()->assertSessionHas('status', session('status'));
    Notification::assertSentTo($user, ResetPassword::class);
});

test('password recovery requests are rate limited without revealing it', function () {
    Notification::fake();
    $user = User::factory()->create();

    foreach (range(1, 5) as $attempt) {
        $this->post(route('password.email'), ['email' => "otra{$attempt}@example.com"]);
    }

    $this->post(route('password.email'), ['email' => $user->email])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('status');

    Notification::assertNotSentTo($user, ResetPassword::class);
});

test('asking for a password reset does not cancel a pending invitation', function () {
    Notification::fake();
    $invited = app(InviteUser::class)->handle('Invitada', 'invitada@example.com');

    expect(DB::table('invitation_tokens')->where('email', $invited->email)->exists())->toBeTrue();

    $this->post(route('password.email'), ['email' => $invited->email]);

    expect(DB::table('invitation_tokens')->where('email', $invited->email)->exists())->toBeTrue();
});

test('the owner is told when an administrator sets a temporary password', function () {
    Notification::fake();
    $admin = User::factory()->superuser()->create();
    $user = User::factory()->create();

    $this->actingAs($admin)
        ->put(route('admin.users.temporary-password', $user), ['password' => 'temporal-123', 'password_confirmation' => 'temporal-123'])
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($user, AccountChangedByAdministrator::class, fn ($n) => $n->change === 'temporary_password');
});

test('the previous address is told when an administrator changes the email', function () {
    Notification::fake();
    $admin = User::factory()->superuser()->create();
    $user = User::factory()->create(['email' => 'antes@example.com']);

    $this->actingAs($admin)
        ->patch(route('admin.users.update', $user), ['name' => $user->name, 'email' => 'despues@example.com', 'role' => 'user'])
        ->assertSessionHasNoErrors();

    Notification::assertSentOnDemand(
        AccountChangedByAdministrator::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'antes@example.com'
            && $notification->newEmail === 'despues@example.com',
    );
});
