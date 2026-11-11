<?php

namespace App\Http\Controllers;

use App\Branding\Brand;
use Illuminate\Http\JsonResponse;

/**
 * Manifiesto de la PWA, generado a partir de la identidad configurada.
 */
class ManifestController extends Controller
{
    public function __invoke(Brand $brand): JsonResponse
    {
        $identity = $brand->resolved();
        $urls = $identity['urls'];

        return response()->json([
            'id' => '/',
            'name' => $identity['name'],
            'short_name' => $identity['short_name'],
            'description' => 'Organiza tus cuentas, anticipa pagos y ahorra con calma.',
            'lang' => 'es',
            'dir' => 'ltr',
            'start_url' => '/dashboard',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'portrait',
            'background_color' => $identity['background_color'],
            'theme_color' => $identity['theme_color'],
            'icons' => array_values(array_filter([
                $urls['pwa_192'] ? ['src' => $urls['pwa_192'], 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'] : null,
                $urls['pwa_512'] ? ['src' => $urls['pwa_512'], 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'] : null,
                $urls['pwa_maskable'] ? ['src' => $urls['pwa_maskable'], 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'] : null,
            ])),
        ], 200, ['Content-Type' => 'application/manifest+json']);
    }
}
