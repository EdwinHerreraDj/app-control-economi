<?php

namespace App\Models;

use App\Enums\MascotState;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Mascota del catálogo. Es el mismo personaje en todos los estados.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string|null $description
 * @property string $status draft | published | archived
 * @property bool $is_default
 */
class Mascot extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    /**
     * @return HasMany<MascotAsset, $this>
     */
    public function assets(): HasMany
    {
        return $this->hasMany(MascotAsset::class);
    }

    /**
     * @return HasMany<MascotMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(MascotMessage::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /**
     * @param  Builder<Mascot>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', 'published');
    }

    /**
     * Estados obligatorios que aún no tienen imagen.
     *
     * @return list<MascotState>
     */
    public function missingRequired(): array
    {
        $present = $this->assets->pluck('state')->all();

        return array_values(array_filter(
            MascotState::cases(),
            fn (MascotState $state) => $state->isRequired() && ! in_array($state->value, $present, true),
        ));
    }

    /**
     * Imágenes por estado; los que no tienen propia usan la de reposo.
     *
     * @return array<string, array{static: string|null, animated: string|null, own: bool}>
     */
    public function images(): array
    {
        $assets = $this->assets->loadMissing(['media', 'animated'])->keyBy('state');
        $idle = $assets->get(MascotState::Idle->value);
        $images = [];

        foreach (MascotState::cases() as $state) {
            $asset = $assets->get($state->value) ?? $idle;
            $images[$state->value] = [
                'static' => $asset?->media?->url(),
                'animated' => $asset?->animated?->url(),
                'own' => $assets->has($state->value),
            ];
        }

        return $images;
    }

    public static function default(): ?self
    {
        return static::query()->published()->where('is_default', true)->first()
            ?? static::query()->published()->orderBy('id')->first();
    }
}
