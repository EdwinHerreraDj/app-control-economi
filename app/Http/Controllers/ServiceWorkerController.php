<?php

namespace App\Http\Controllers;

use App\Branding\Brand;
use Illuminate\Http\Response;

/**
 * Sirve el service worker desde la raíz (/sw.js) con la lista de recursos
 * compilados que debe guardar. La versión cambia con cada compilación, con
 * la identidad visual o con el propio service worker, y eso hace que el
 * navegador detecte la actualización.
 */
class ServiceWorkerController extends Controller
{
    public function __invoke(Brand $brand): Response
    {
        $precache = $this->buildAssets();
        $media = collect($brand->resolved()['urls'])
            ->only(['logo', 'logo_dark', 'logo_square', 'favicon_ico', 'favicon_svg', 'pwa_192', 'apple_touch'])
            ->filter()
            ->push('/manifest.webmanifest')
            ->unique()
            ->values()
            ->all();

        $template = (string) file_get_contents(resource_path('pwa/service-worker.js'));
        $version = substr(sha1((string) json_encode([$precache, $media, $template])), 0, 12);

        $script = sprintf(
            "const VERSION = %s;\nconst PRECACHE = %s;\nconst MEDIA = %s;\n\n%s",
            json_encode($version),
            json_encode($precache, JSON_UNESCAPED_SLASHES),
            json_encode($media, JSON_UNESCAPED_SLASHES),
            $template,
        );

        return response($script, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'no-cache',
            'Service-Worker-Allowed' => '/',
        ]);
    }

    /**
     * Archivos de la compilación de Vite (JS, CSS y fuentes woff2).
     *
     * @return list<string>
     */
    private function buildAssets(): array
    {
        $path = public_path('build/manifest.json');

        if (! is_file($path)) {
            return [];
        }

        /** @var array<string, array{file?: string, css?: list<string>, assets?: list<string>}> $manifest */
        $manifest = json_decode((string) file_get_contents($path), true) ?: [];
        $files = [];

        foreach ($manifest as $entry) {
            foreach ([$entry['file'] ?? null, ...($entry['css'] ?? []), ...($entry['assets'] ?? [])] as $file) {
                if (is_string($file)) {
                    $files[] = $file;
                }
            }
        }

        // Fuentes incluidas por el plugin de Vite (fuera del manifiesto).
        foreach (glob(public_path('build/assets/*.woff2')) ?: [] as $font) {
            $files[] = 'assets/'.basename($font);
        }

        $fonts = public_path('build/fonts-manifest.json');
        if (is_file($fonts)) {
            /** @var array{style?: array{file?: string}} $fontManifest */
            $fontManifest = json_decode((string) file_get_contents($fonts), true) ?: [];
            if (isset($fontManifest['style']['file'])) {
                $files[] = $fontManifest['style']['file'];
            }
        }

        $files = array_values(array_unique($files));
        sort($files);

        return array_map(fn (string $file) => '/build/'.ltrim($file, '/'), $files);
    }
}
