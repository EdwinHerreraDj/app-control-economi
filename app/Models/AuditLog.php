<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Auth;

/**
 * Registro de acciones sensibles y administrativas.
 *
 * Nunca debe guardar contraseñas, tokens ni importes financieros.
 *
 * @property int|null $actor_id
 * @property string $action
 * @property array<string, mixed>|null $properties
 * @property string|null $ip_address
 * @property CarbonImmutable|null $created_at
 * @property-read User|null $actor
 * @property-read Model|null $subject
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @param  array<string, mixed>  $properties
     */
    public static function record(string $action, ?Model $subject = null, array $properties = [], ?User $actor = null): self
    {
        $fromConsole = app()->runningInConsole() && ! app()->runningUnitTests();

        return self::create([
            'actor_id' => $actor?->getKey() ?? Auth::id(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'properties' => $properties ?: null,
            'ip_address' => $fromConsole ? null : request()->ip(),
        ]);
    }
}
