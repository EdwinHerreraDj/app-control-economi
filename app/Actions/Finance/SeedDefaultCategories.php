<?php

namespace App\Actions\Finance;

use App\Enums\CategoryKind;
use App\Models\Category;
use App\Models\User;

class SeedDefaultCategories
{
    /**
     * Crea las categorías orientativas iniciales. Si el usuario ya tiene
     * alguna categoría no hace nada, para poder llamarse sin duplicar.
     */
    public function handle(User $user): void
    {
        if ($user->categories()->exists()) {
            return;
        }

        /** @var array<string, list<array{0: string, 1: string, 2: string}>> $defaults */
        $defaults = config('finance.default_categories');

        foreach ($defaults as $kind => $categories) {
            foreach ($categories as [$name, $icon, $color]) {
                $category = new Category([
                    'kind' => CategoryKind::from($kind),
                    'name' => $name,
                    'icon' => $icon,
                    'color' => $color,
                ]);
                $category->user()->associate($user);
                $category->save();
            }
        }
    }
}
