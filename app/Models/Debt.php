<?php

namespace App\Models;

use App\Enums\Frequency;
use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Dinero que el usuario debe (préstamos, créditos, aplazamientos...).
 *
 * El capital pendiente no se guarda: se calcula restando al capital inicial
 * el capital devuelto en los pagos no anulados.
 *
 * @property int $id
 * @property string $creditor
 * @property string $concept
 * @property string $currency
 * @property int $principal
 * @property CarbonImmutable $started_on
 * @property int|null $installment
 * @property Frequency|null $frequency
 * @property CarbonImmutable|null $next_due_on
 * @property string|null $interest_rate
 * @property string|null $notes
 * @property CarbonImmutable|null $settled_at
 */
class Debt extends Model
{
    use BelongsToUser;

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return [
            'principal' => 'integer',
            'installment' => 'integer',
            'frequency' => Frequency::class,
            'started_on' => 'immutable_date',
            'next_due_on' => 'immutable_date',
            'interest_rate' => 'decimal:4',
            'settled_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<DebtPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }

    /**
     * Movimiento con el que se recibió el dinero del préstamo, si lo hubo.
     *
     * @return HasMany<Transaction, $this>
     */
    public function disbursements(): HasMany
    {
        return $this->hasMany(Transaction::class)->whereNull('debt_payment_id');
    }

    /** Capital devuelto en pagos no anulados (unidades menores). */
    public function repaidPrincipal(): int
    {
        return (int) $this->payments()->whereNull('voided_at')->sum('principal_amount');
    }

    public function outstanding(): int
    {
        return max(0, $this->principal - $this->repaidPrincipal());
    }

    public function isSettled(): bool
    {
        return $this->settled_at !== null;
    }
}
