<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Plantilla de mensaje para un estado. Solo admite las variables de
 * MascotMessageRenderer::VARIABLES.
 *
 * @property int $id
 * @property int|null $mascot_id
 * @property string $state
 * @property string $template
 * @property bool $active
 */
class MascotMessage extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
