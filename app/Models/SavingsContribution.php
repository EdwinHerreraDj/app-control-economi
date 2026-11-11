<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aportación (positiva) o retirada (negativa) de lo reservado para un
 * objetivo de ahorro.
 *
 * @property int $id
 * @property int $savings_goal_id
 * @property int $amount
 * @property string $currency
 * @property CarbonImmutable $contributed_on
 * @property string|null $note
 */
class SavingsContribution extends Model
{
    use BelongsToUser;

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'contributed_on' => 'immutable_date',
        ];
    }

    /**
     * @return BelongsTo<SavingsGoal, $this>
     */
    public function goal(): BelongsTo
    {
        return $this->belongsTo(SavingsGoal::class, 'savings_goal_id');
    }
}
