<?php

namespace App\Branding;

use App\Models\AppSetting;
use App\Models\MediaAsset;
use Illuminate\Support\Facades\Cache;

/**
 * Identidad visual vigente: lo configurado por el superusuario o, en su
 * defecto, los valores y recursos por defecto de public/brand.
 */
class Brand
{
    private const CACHE_KEY = 'brand.resolved';

    private const SETTING = 'brand';

    /**
     * @return array{name: string, short_name: string, theme_color: string, background_color: string, primary_color: string|null, assets: array<string, int>}
     */
    public function settings(): array
    {
        /** @var array<string, mixed> $stored */
        $stored = AppSetting::read(self::SETTING, []);
        /** @var array<string, mixed> $defaults */
        $defaults = config('branding.defaults');

        return [
            'name' => (string) ($stored['name'] ?? $defaults['name']),
            'short_name' => (string) ($stored['short_name'] ?? $defaults['short_name']),
            'theme_color' => (string) ($stored['theme_color'] ?? $defaults['theme_color']),
            'background_color' => (string) ($stored['background_color'] ?? $defaults['background_color']),
            'primary_color' => $stored['primary_color'] ?? $defaults['primary_color'],
            'assets' => array_map('intval', (array) ($stored['assets'] ?? [])),
        ];
    }

    /**
     * Identidad lista para usar en vistas, manifiesto e interfaz.
     *
     * @return array{name: string, short_name: string, theme_color: string, background_color: string, primary_color: string|null, urls: array<string, string|null>, custom: array<string, bool>}
     */
    public function resolved(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $settings = $this->settings();
            $media = MediaAsset::query()->whereIn('id', array_values($settings['assets']))->get()->keyBy('id');
            $urls = [];
            $custom = [];

            /** @var array<string, array<string, mixed>> $definitions */
            $definitions = config('branding.assets');

            foreach ($definitions as $key => $definition) {
                $asset = isset($settings['assets'][$key]) ? $media->get($settings['assets'][$key]) : null;
                $custom[$key] = $asset !== null;
                $urls[$key] = $asset?->url()
                    // Rutas relativas: la identidad se cachea y no debe fijar un dominio.
                    ?? (isset($definition['default']) ? '/'.ltrim((string) $definition['default'], '/') : null);
            }

            return [
                'name' => $settings['name'],
                'short_name' => $settings['short_name'],
                'theme_color' => $settings['theme_color'],
                'background_color' => $settings['background_color'],
                'primary_color' => $settings['primary_color'],
                'urls' => $urls,
                'custom' => $custom,
            ];
        });
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    public function update(array $changes): void
    {
        $settings = $this->settings();

        foreach ($changes as $key => $value) {
            if ($key === 'assets') {
                $settings['assets'] = array_filter([...$settings['assets'], ...$value], fn ($id) => $id !== null);
            } else {
                $settings[$key] = $value;
            }
        }

        AppSetting::write(self::SETTING, $settings);
        $this->forget();
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
