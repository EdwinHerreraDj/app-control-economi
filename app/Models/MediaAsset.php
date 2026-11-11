<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Archivo subido (logotipos, iconos, imágenes de mascotas).
 *
 * @property int $id
 * @property string $purpose
 * @property string $disk
 * @property string $path
 * @property string $mime
 * @property int $size
 * @property int|null $width
 * @property int|null $height
 * @property int|null $duration_ms
 * @property string $checksum
 */
class MediaAsset extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration_ms' => 'integer',
        ];
    }

    /**
     * URL pública. El nombre del archivo es único, así que no hay caché antigua.
     * En el disco público es relativa al dominio, para que funcione con
     * cualquier dominio y no dependa de APP_URL.
     */
    public function url(): string
    {
        if ($this->disk === 'public') {
            return '/storage/'.ltrim($this->path, '/');
        }

        return Storage::disk($this->disk)->url($this->path);
    }
}
