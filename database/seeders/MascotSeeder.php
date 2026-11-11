<?php

namespace Database\Seeders;

use App\Enums\MascotState;
use App\Media\MediaStore;
use App\Models\Mascot;
use App\Models\MascotAsset;
use App\Models\MascotMessage;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Mascotas iniciales (resources/mascots) y mensajes comunes.
 *
 * Idempotente: se puede ejecutar varias veces sin duplicar nada ni pisar
 * los cambios hechos después desde la administración.
 */
class MascotSeeder extends Seeder
{
    private const MASCOTS = [
        'brote' => [
            'name' => 'Brote',
            'description' => 'Una semilla con un brote en la cabeza. Crece contigo, paso a paso.',
            'default' => true,
        ],
        'pita' => [
            'name' => 'Pita',
            'description' => 'Una lechuza tranquila y observadora que te acompaña a mirar tus cuentas con calma.',
            'default' => false,
        ],
    ];

    /** Mensajes comunes por estado. Prudentes: hablan de previsiones, no de certezas. */
    private const MESSAGES = [
        'welcome' => [
            '¡Hola, {nombre}! Me alegra verte por aquí.',
            'Hola, {nombre}. Vamos a echar un vistazo juntos.',
        ],
        'idle' => [
            'Con lo registrado, tus pagos previstos están cubiertos.',
            'Todo en orden por ahora. Aquí estoy si me necesitas.',
        ],
        'celebration' => [
            '¡Lo has conseguido: {objetivo}! Buen trabajo, {nombre}.',
            '¡Un hito alcanzado! Merece la pena celebrarlo.',
        ],
        'attention' => [
            'Con lo previsto, tu saldo podría bajar hasta {saldo_minimo} hacia el {fecha}. Quizá quieras revisar los próximos vencimientos.',
            'El margen de las próximas semanas parece ajustado. Echemos un vistazo a lo previsto.',
        ],
        'support' => [
            'Con los movimientos registrados, podrían faltar {faltante} hacia el {fecha}. Si quieres, revisamos juntos los próximos pagos.',
            'Se ve un momento ajustado en el horizonte. Paso a paso: los próximos vencimientos son un buen punto de partida.',
        ],
        'unknown' => [
            'Aún me faltan datos para orientarte. Cuando registres tus movimientos, podré ayudarte mejor.',
            'Hace tiempo que no veo movimientos nuevos. ¿Quieres ponerlos al día?',
        ],
    ];

    public function run(MediaStore $store): void
    {
        DB::transaction(function () use ($store) {
            foreach (self::MASCOTS as $slug => $data) {
                if (Mascot::query()->where('slug', $slug)->exists()) {
                    continue;
                }

                $mascot = Mascot::create([
                    'slug' => $slug,
                    'name' => $data['name'],
                    'description' => $data['description'],
                    'status' => 'published',
                    'is_default' => $data['default'] && ! Mascot::query()->where('is_default', true)->exists(),
                ]);

                /** @var array{mimes: list<string>, max_kb: int, width: int, height: int} $rules */
                $rules = config('branding.mascot.static');

                foreach (MascotState::cases() as $state) {
                    $file = resource_path("mascots/{$slug}/{$state->value}.png");

                    if (! is_file($file)) {
                        continue;
                    }

                    $media = $store->store((string) file_get_contents($file), 'mascots', $rules);
                    MascotAsset::create(['mascot_id' => $mascot->id, 'state' => $state->value, 'media_asset_id' => $media->id]);
                }
            }

            if (! MascotMessage::query()->whereNull('mascot_id')->exists()) {
                foreach (self::MESSAGES as $state => $templates) {
                    foreach ($templates as $template) {
                        MascotMessage::create(['mascot_id' => null, 'state' => $state, 'template' => $template]);
                    }
                }
            }
        });
    }
}
