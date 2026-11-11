<?php

use App\Models\AuditLog;
use App\Models\User;
use App\Support\FinancialFootprint;
use Inertia\Testing\AssertableInertia as Assert;

/** Simula que el usuario ya tiene datos financieros registrados. */
function withFinancialRecords(): void
{
    app()->instance(FinancialFootprint::class, new class extends FinancialFootprint
    {
        public function hasRecords(User $user): bool
        {
            return true;
        }
    });
}

$valid = [
    'currency' => 'COP',
    'number_locale' => 'es-CO',
    'timezone' => 'America/Bogota',
    'locale' => 'es',
];

test('users without a currency are sent to the first-time setup', function () {
    $user = User::factory()->notOnboarded()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));

    $this->actingAs($user)
        ->get(route('onboarding.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('onboarding')
            ->has('options.currencies')
            ->has('options.timezones')
            ->where('preferences.currency', null));
});

test('the currency is never assumed', function () use ($valid) {
    $user = User::factory()->notOnboarded()->create();

    $this->actingAs($user)
        ->post(route('onboarding.store'), [...$valid, 'currency' => ''])
        ->assertSessionHasErrors(['currency' => 'Elige tu moneda principal.']);

    expect($user->fresh()->currency)->toBeNull();
});

test('completing the setup saves the preferences', function () use ($valid) {
    $user = User::factory()->notOnboarded()->create();

    $this->actingAs($user)
        ->post(route('onboarding.store'), $valid)
        ->assertRedirect(route('dashboard'));

    $user->refresh();

    expect($user->currency)->toBe('COP')
        ->and($user->number_locale)->toBe('es-CO')
        ->and($user->timezone)->toBe('America/Bogota')
        ->and($user->hasCompletedOnboarding())->toBeTrue();

    $this->actingAs($user)->get(route('dashboard'))->assertOk();
    $this->actingAs($user)->get(route('onboarding.show'))->assertRedirect(route('dashboard'));
});

test('invalid options are rejected', function () use ($valid) {
    $user = User::factory()->notOnboarded()->create();

    $this->actingAs($user)
        ->post(route('onboarding.store'), [
            ...$valid,
            'currency' => 'XXX',
            'number_locale' => 'xx-XX',
            'timezone' => 'Marte/Olympus',
            'locale' => 'fr',
        ])
        ->assertSessionHasErrors(['currency', 'number_locale', 'timezone', 'locale']);
});

test('the preferences page shows the current values', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('preferences.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/preferences')
            ->where('canChangeCurrency', true)
            ->where('preferences.currency', 'EUR')
            ->where('preferences.currency_decimals', 2)
            ->where('preferences.timezone', 'Europe/Madrid'));
});

test('the currency can be changed freely while there is no financial data', function () use ($valid) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('preferences.edit'))
        ->put(route('preferences.update'), $valid)
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('preferences.edit'));

    expect($user->fresh()->currency)->toBe('COP')
        ->and(AuditLog::where('action', 'user.currency_changed')->first()?->properties)
        ->toBe(['from' => 'EUR', 'to' => 'COP']);
});

test('the currency cannot be changed once there is financial data', function () use ($valid) {
    withFinancialRecords();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('preferences.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('canChangeCurrency', false));

    $this->actingAs($user)
        ->from(route('preferences.edit'))
        ->put(route('preferences.update'), $valid)
        ->assertSessionHasErrors('currency');

    expect($user->fresh()->currency)->toBe('EUR');
});

test('other preferences can still change when the currency is locked', function () use ($valid) {
    withFinancialRecords();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('preferences.update'), [...$valid, 'currency' => 'EUR'])
        ->assertSessionHasNoErrors();

    expect($user->fresh())
        ->currency->toBe('EUR')
        ->timezone->toBe('America/Bogota');
});

test('server messages are in Spanish', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->patch(route('profile.update'), ['name' => '', 'email' => 'no-es-un-correo'])
        ->assertSessionHasErrors([
            'name' => 'El campo nombre es obligatorio.',
        ]);

    $this->post(route('logout'));

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'incorrecta'])
        ->assertSessionHasErrors(['email' => 'El correo o la contraseña no son correctos.']);
});
