<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pago de una deuda con su desglose. Genera en la cuenta un movimiento de
 * capital (no es gasto) y otro de intereses y comisiones (sí es gasto).
 *
 * @property int $id
 * @property string $uuid
 * @property int $debt_id
 * @property int $account_id
 * @property int|null $category_id
 * @property CarbonImmutable $paid_on
 * @property int $principal_amount
 * @property int $interest_amount
 * @property int $fees_amount
 * @property string $currency
 * @property string|null $notes
 * @property CarbonImmutable|null $voided_at
 * @property string|null $void_reason
 * @property-read Debt $debt
 * @property-read Account $account
 */
class DebtPayment extends Model
{
    use BelongsToUser, HasUuids;

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
            'paid_on' => 'immutable_date',
            'principal_amount' => 'integer',
            'interest_amount' => 'integer',
            'fees_amount' => 'integer',
            'voided_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Debt, $this>
     */
    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function total(): int
    {
        return $this->principal_amount + $this->interest_amount + $this->fees_amount;
    }

    public function isVoided(): bool
    {
        return $this->voided_at !== null;
    }
}
