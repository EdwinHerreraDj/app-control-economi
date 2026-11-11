<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'role' => UserRole::User,
            'status' => UserStatus::Active,
            'activated_at' => now(),
            'currency' => 'EUR',
            'number_locale' => 'es-ES',
            'timezone' => 'Europe/Madrid',
            'locale' => 'es',
            'onboarded_at' => now(),
        ];
    }

    /** Cuenta activa que todavía no ha hecho la primera configuración. */
    public function notOnboarded(): static
    {
        return $this->state(fn (array $attributes) => [
            'currency' => null,
            'timezone' => 'UTC',
            'onboarded_at' => null,
        ]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function superuser(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Superuser,
        ]);
    }

    /** Invitado que aún no ha establecido su contraseña. */
    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => UserStatus::Pending,
            'password' => null,
            'email_verified_at' => null,
            'invited_at' => now(),
            'activated_at' => null,
            'currency' => null,
            'onboarded_at' => null,
        ]);
    }

    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => UserStatus::Suspended,
            'suspended_at' => now(),
        ]);
    }
}
