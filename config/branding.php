<?php

/*
|--------------------------------------------------------------------------
| Identidad visual: recursos configurables por el superusuario
|--------------------------------------------------------------------------
|
| Cada recurso indica formatos admitidos (por contenido real), peso máximo,
| medidas y la ayuda que ve el superusuario (CONTEXT.md §11). Los valores
| por defecto viven en public/brand y se usan mientras no se suba otro.
|
*/

return [

    'defaults' => [
        'name' => 'Economía Personal',
        'short_name' => 'Economía',
        'theme_color' => '#0f766e',
        'background_color' => '#f6f9f8',
        'primary_color' => null,
    ],

    'assets' => [
        'source' => [
            'label' => 'Original para generar los iconos',
            'help' => 'PNG cuadrado de 1024 × 1024 px o más. A partir de él se generan los iconos PWA, el de Apple, el favicon y el logo cuadrado; luego puedes sustituir cualquiera por separado.',
            'mimes' => ['image/png'],
            'max_kb' => 5120,
            'min_width' => 512,
            'square' => true,
            'preview' => 'square',
        ],
        'logo' => [
            'label' => 'Logotipo horizontal',
            'help' => 'SVG (se sanea) o PNG con fondo transparente. Referencia: 1200 × 400 px.',
            'mimes' => ['image/svg+xml', 'image/png'],
            'max_kb' => 1024,
            'preview' => 'logo',
            'default' => null,
        ],
        'logo_dark' => [
            'label' => 'Logotipo para fondos oscuros',
            'help' => 'Variante clara del logotipo para el tema oscuro. SVG o PNG transparente, 1200 × 400 px.',
            'mimes' => ['image/svg+xml', 'image/png'],
            'max_kb' => 1024,
            'preview' => 'logo-dark',
            'default' => null,
        ],
        'logo_square' => [
            'label' => 'Logotipo cuadrado',
            'help' => 'PNG de 512 × 512 px, preferiblemente transparente. Aparece en la barra lateral y en el acceso.',
            'mimes' => ['image/png'],
            'max_kb' => 1024,
            'width' => 512,
            'height' => 512,
            'preview' => 'square',
            'default' => 'brand/logo-square.png',
        ],
        'favicon_ico' => [
            'label' => 'Favicon (ICO)',
            'help' => 'Archivo ICO que incluya 16, 32 y 48 px.',
            'mimes' => ['image/x-icon'],
            'max_kb' => 200,
            'ico_sizes' => [16, 32, 48],
            'preview' => 'favicon',
            'default' => 'brand/favicon.ico',
        ],
        'favicon_svg' => [
            'label' => 'Favicon (SVG, opcional)',
            'help' => 'SVG cuadrado y sencillo; se sanea al subirlo. Los navegadores modernos lo prefieren al ICO.',
            'mimes' => ['image/svg+xml'],
            'max_kb' => 100,
            'preview' => 'favicon',
            'default' => 'brand/favicon.svg',
        ],
        'pwa_192' => [
            'label' => 'Icono PWA 192 px',
            'help' => 'PNG de 192 × 192 px.',
            'mimes' => ['image/png'],
            'max_kb' => 300,
            'width' => 192,
            'height' => 192,
            'preview' => 'app',
            'default' => 'brand/pwa-192.png',
        ],
        'pwa_512' => [
            'label' => 'Icono PWA 512 px',
            'help' => 'PNG de 512 × 512 px.',
            'mimes' => ['image/png'],
            'max_kb' => 800,
            'width' => 512,
            'height' => 512,
            'preview' => 'app',
            'default' => 'brand/pwa-512.png',
        ],
        'pwa_maskable' => [
            'label' => 'Icono PWA adaptable (maskable)',
            'help' => 'PNG de 512 × 512 px con fondo opaco. Lo esencial debe quedar dentro del círculo central (80 % del lienzo): el sistema puede recortar el resto.',
            'mimes' => ['image/png'],
            'max_kb' => 800,
            'width' => 512,
            'height' => 512,
            'opaque' => true,
            'preview' => 'maskable',
            'default' => 'brand/pwa-maskable.png',
        ],
        'apple_touch' => [
            'label' => 'Icono de Apple',
            'help' => 'PNG de 180 × 180 px con fondo opaco (iOS no admite transparencia).',
            'mimes' => ['image/png'],
            'max_kb' => 300,
            'width' => 180,
            'height' => 180,
            'preview' => 'app',
            'default' => 'brand/apple-touch-icon.png',
        ],
    ],

    'mascot' => [
        'static' => ['mimes' => ['image/png', 'image/webp'], 'max_kb' => 1024, 'width' => 512, 'height' => 512],
        'animated' => ['mimes' => ['image/webp'], 'max_kb' => 3072, 'width' => 512, 'height' => 512, 'max_duration_ms' => 4000],
    ],

];
