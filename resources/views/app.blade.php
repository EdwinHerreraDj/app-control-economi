<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script nonce="{{ Vite::cspNonce() }}">
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(0.982 0.004 185);
            }

            html.dark {
                background-color: oklch(0.17 0.014 215);
            }
        </style>

        @php($brand = app(\App\Branding\Brand::class)->resolved())

        @if ($brand['primary_color'])
            {{-- Color principal de la marca (tema claro). Se valida su contraste al guardarlo. --}}
            <style>
                :root:not(.dark) {
                    --primary: {{ $brand['primary_color'] }};
                    --sidebar-primary: {{ $brand['primary_color'] }};
                    --ring: {{ $brand['primary_color'] }};
                }
            </style>
        @endif

        <meta name="application-name" content="{{ $brand['name'] }}">
        <meta name="apple-mobile-web-app-title" content="{{ $brand['short_name'] }}">
        <meta name="theme-color" content="{{ $brand['theme_color'] }}">
        <meta name="color-scheme" content="light dark">

        <link rel="manifest" href="{{ route('manifest') }}">
        @if ($brand['urls']['favicon_ico'])
            <link rel="icon" href="{{ $brand['urls']['favicon_ico'] }}" sizes="any">
        @endif
        @if ($brand['urls']['favicon_svg'])
            <link rel="icon" href="{{ $brand['urls']['favicon_svg'] }}" type="image/svg+xml">
        @endif
        @if ($brand['urls']['apple_touch'])
            <link rel="apple-touch-icon" href="{{ $brand['urls']['apple_touch'] }}">
        @endif

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ $brand['name'] }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
