<?php

namespace Database\Factories;

use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'user_id' => fn (array $attributes) => Account::query()->whereKey($attributes['account_id'])->first()?->user_id,
            'currency' => fn (array $attributes) => Account::query()->whereKey($attributes['account_id'])->first()->currency ?? 'EUR',
            'kind' => TransactionKind::Expense,
            'status' => TransactionStatus::Confirmed,
            'amount' => 1000,
            'occurred_on' => now()->toDateString(),
            'concept' => fake()->sentence(3),
        ];
    }

    public function income(): static
    {
        return $this->state(fn () => ['kind' => TransactionKind::Income]);
    }

    public function planned(): static
    {
        return $this->state(fn () => ['status' => TransactionStatus::Planned]);
    }
}
