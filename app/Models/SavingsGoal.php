<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Objetivo de ahorro. Su progreso es la suma de lo reservado en las
 * aportaciones; reservar no mueve dinero entre cuentas.
 *
 * @property int $id
 * @property string $name
 * @property int $target_amount
 * @property string $currency
 * @property CarbonImmutable|null $target_date
 * @property string $icon
 * @property string $color
 * @property CarbonImmutable|null $achieved_at
 * @property CarbonImmutable|null $archived_at
 * @property-read int|string|null $contributions_sum_amount Suma de aportaciones (con withSum).
 */
class SavingsGoal extends Model
{
    use BelongsToUser;

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return [
            'target_amount' => 'integer',
            'target_date' => 'immutable_date',
            'achieved_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<SavingsContribution, $this>
     */
    public function contributions(): HasMany
    {
        return $this->hasMany(SavingsContribution::class);
    }

    public function savedAmount(): int
    {
        return (int) $this->contributions()->sum('amount');
    }
}
