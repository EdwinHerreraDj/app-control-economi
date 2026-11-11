<?php

namespace Database\Factories;

use App\Enums\CategoryKind;
use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'kind' => CategoryKind::Expense,
            'name' => fake()->unique()->words(2, true),
            'icon' => 'tag',
            'color' => 'teal',
        ];
    }

    public function income(): static
    {
        return $this->state(fn () => ['kind' => CategoryKind::Income]);
    }
}
