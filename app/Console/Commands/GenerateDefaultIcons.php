<?php

namespace App\Console\Commands;

use App\Media\IconGenerator;
use Illuminate\Console\Command;

/**
 * Regenera los iconos por defecto (public/brand) a partir de
 * public/brand/source.png. Solo hace falta si cambia la identidad por
 * defecto del proyecto; la que sube el superusuario se gestiona desde
 * Administración → Identidad visual.
 */
class GenerateDefaultIcons extends Command
{
    protected $signature = 'app:generate-default-icons';

    protected $description = 'Genera los iconos por defecto a partir de public/brand/source.png';

    private const FILES = [
        'logo_square' => 'logo-square.png',
        'pwa_512' => 'pwa-512.png',
        'pwa_192' => 'pwa-192.png',
        'apple_touch' => 'apple-touch-icon.png',
        'pwa_maskable' => 'pwa-maskable.png',
        'favicon_ico' => 'favicon.ico',
    ];

    public function handle(IconGenerator $generator): int
    {
        $source = public_path('brand/source.png');

        if (! is_file($source)) {
            $this->components->error('Falta public/brand/source.png (node scripts/brand/render-default.mjs).');

            return self::FAILURE;
        }

        $icons = $generator->fromSource((string) file_get_contents($source), (string) config('branding.defaults.theme_color'));

        foreach (self::FILES as $key => $file) {
            file_put_contents(public_path("brand/{$file}"), $icons[$key]);
            $this->components->twoColumnDetail($file, 'generado');
        }

        return self::SUCCESS;
    }
}
