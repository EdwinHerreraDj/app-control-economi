<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Transferencia entre dos cuentas propias. Genera dos movimientos
 * enlazados (salida y entrada) que no cuentan como gasto ni ingreso.
 *
 * @property int $id
 * @property string $uuid
 * @property int $from_account_id
 * @property int $to_account_id
 * @property int $amount
 * @property string $currency
 * @property CarbonImmutable $occurred_on
 * @property TransactionStatus $status
 * @property string|null $concept
 * @property string|null $notes
 * @property CarbonImmutable|null $voided_at
 * @property string|null $void_reason
 * @property-read Account $fromAccount
 * @property-read Account $toAccount
 */
class Transfer extends Model
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
            'amount' => 'integer',
            'occurred_on' => 'immutable_date',
            'status' => TransactionStatus::class,
            'voided_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function fromAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'from_account_id');
    }

    /**
     * @return BelongsTo<Account, $this>
     */
    public function toAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'to_account_id');
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function isVoided(): bool
    {
        return $this->voided_at !== null;
    }
}
