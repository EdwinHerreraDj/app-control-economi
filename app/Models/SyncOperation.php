<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Resultado de una operación enviada desde un dispositivo sin conexión.
 *
 * @property int $id
 * @property int $user_id
 * @property string $uuid
 * @property string $type
 * @property string $status
 * @property int|null $transaction_id
 * @property array<string, list<string>>|null $errors
 * @property int $attempts
 * @property CarbonImmutable|null $client_created_at
 */
class SyncOperation extends Model
{
    use BelongsToUser;

    public const APPLIED = 'applied';

    public const REJECTED = 'rejected';

    public const CONFLICT = 'conflict';

    protected $guarded = ['id', 'user_id'];

    protected function casts(): array
    {
        return [
            'errors' => 'array',
            'attempts' => 'integer',
            'client_created_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Transaction, $this>
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
