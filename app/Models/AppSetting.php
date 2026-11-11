<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Configuración global (clave → valor JSON). Solo la cambia el superusuario.
 *
 * @property string $key
 * @property mixed $value
 */
class AppSetting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public static function read(string $key, mixed $default = null): mixed
    {
        $setting = static::query()->find($key);

        return $setting === null ? $default : ($setting->value ?? $default);
    }

    public static function write(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
