<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Límite mensual de gasto para una categoría. Es una reserva
 * presupuestaria: no mueve dinero entre cuentas.
 *
 * @property int $id
 * @property int $category_id
 * @property int $amount
 * @property string $currency
 * @property-read Category $category
 */
class Budget extends Model
{
    use BelongsToUser;

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return ['amount' => 'integer'];
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
