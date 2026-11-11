<?php

namespace App\Models;

use App\Enums\ExpenseNature;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Movimiento de una cuenta. El importe es siempre positivo; el tipo indica
 * si suma o resta al saldo. Solo los confirmados y no anulados cuentan
 * para el saldo real.
 *
 * @property int $id
 * @property string $uuid
 * @property int $account_id
 * @property int|null $category_id
 * @property int|null $transfer_id
 * @property TransactionKind $kind
 * @property TransactionStatus $status
 * @property int $amount
 * @property string $currency
 * @property CarbonImmutable $occurred_on
 * @property CarbonImmutable|null $due_on
 * @property ExpenseNature|null $nature
 * @property string $concept
 * @property string|null $notes
 * @property CarbonImmutable|null $voided_at
 * @property string|null $void_reason
 * @property-read Account $account
 * @property-read Category|null $category
 * @property-read Transfer|null $transfer
 */
class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use BelongsToUser, HasFactory, HasUuids;

    protected $guarded = ['id', 'user_id'];

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    protected function casts(): array
    {
        return [
            'kind' => TransactionKind::class,
            'status' => TransactionStatus::class,
            'nature' => ExpenseNature::class,
            'amount' => 'integer',
            'occurred_on' => 'immutable_date',
            'due_on' => 'immutable_date',
            'voided_at' => 'datetime',
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
     * @return BelongsTo<Transfer, $this>
     */
    public function transfer(): BelongsTo
    {
        return $this->belongsTo(Transfer::class);
    }

    public function isVoided(): bool
    {
        return $this->voided_at !== null;
    }

    /**
     * Movimientos que forman parte del saldo real.
     *
     * @param  Builder<Transaction>  $query
     */
    public function scopeCountable(Builder $query): void
    {
        $query->where('status', TransactionStatus::Confirmed)->whereNull('voided_at');
    }
}
