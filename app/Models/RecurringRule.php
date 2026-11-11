<?php

namespace App\Models;

use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Ingreso o gasto que se repite. Genera movimientos previstos (nunca los
 * da por cobrados o pagados) para anticipar compromisos.
 *
 * @property int $id
 * @property TransactionKind $kind
 * @property int $account_id
 * @property int $category_id
 * @property int $amount
 * @property string $currency
 * @property string $concept
 * @property ExpenseNature|null $nature
 * @property Frequency $frequency
 * @property CarbonImmutable $starts_on
 * @property CarbonImmutable|null $ends_on
 * @property CarbonImmutable $generate_from
 * @property CarbonImmutable|null $paused_at
 * @property-read Account $account
 * @property-read Category $category
 */
class RecurringRule extends Model
{
    use BelongsToUser;

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return [
            'kind' => TransactionKind::class,
            'nature' => ExpenseNature::class,
            'frequency' => Frequency::class,
            'amount' => 'integer',
            'starts_on' => 'immutable_date',
            'ends_on' => 'immutable_date',
            'generate_from' => 'immutable_date',
            'paused_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function isPaused(): bool
    {
        return $this->paused_at !== null;
    }

    /** Próxima fecha a partir de $today (incluida), o null si ya terminó. */
    public function nextOccurrence(CarbonImmutable $today): ?CarbonImmutable
    {
        $next = $today->greaterThan($this->starts_on)
            ? $this->frequency->nextAfter($this->starts_on, $today->subDay())
            : $this->starts_on;

        return $this->ends_on !== null && $next->greaterThan($this->ends_on) ? null : $next;
    }
}
