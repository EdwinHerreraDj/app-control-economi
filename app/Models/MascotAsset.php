<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Imagen de una mascota para un estado (estática y, opcionalmente, animada).
 *
 * @property int $id
 * @property int $mascot_id
 * @property string $state
 * @property int $media_asset_id
 * @property int|null $animated_media_asset_id
 * @property-read MediaAsset $media
 * @property-read MediaAsset|null $animated
 */
class MascotAsset extends Model
{
    protected $guarded = ['id'];

    /**
     * @return BelongsTo<MediaAsset, $this>
     */
    public function media(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    /**
     * @return BelongsTo<MediaAsset, $this>
     */
    public function animated(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'animated_media_asset_id');
    }
}
