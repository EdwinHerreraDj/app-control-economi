<?php

namespace Database\Factories;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Account>
 */
class AccountFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->randomElement(['Cuenta nómina', 'Ahorro', 'Efectivo', 'Cuenta común']),
            'type' => AccountType::Bank,
            'currency' => fn (array $attributes) => User::query()->whereKey($attributes['user_id'])->first()->currency ?? 'EUR',
            'initial_balance' => 0,
        ];
    }

    public function archived(): static
    {
        return $this->state(fn () => ['archived_at' => now()]);
    }
}
