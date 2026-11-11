{{--
    Página de error estática: se usa en mantenimiento (503) y como respaldo
    cuando la app no puede mostrar su propia página (por ejemplo, sin base
    de datos). No necesita JavaScript ni recursos compilados.
--}}
@php
    $content = \App\Support\ErrorMessages::for($status);

    try {
        $resolved = app(\App\Branding\Brand::class)->resolved();
        $brandName = $resolved['name'];
        $logo = $resolved['urls']['logo_square'] ?? null;
    } catch (\Throwable) {
        $brandName = config('branding.defaults.name', config('app.name'));
        $logo = '/brand/logo-square.png';
    }
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="robots" content="noindex">
    @if ($status === 503)
        {{-- Vuelve a comprobar solo cada minuto. --}}
        <meta http-equiv="refresh" content="60">
    @endif
    <title>{{ $content['title'] }} - {{ $brandName }}</title>
    <link rel="icon" href="/favicon.ico" sizes="any">
    <style>
        :root {
            --background: oklch(0.982 0.004 185);
            --foreground: oklch(0.22 0.02 205);
            --primary: oklch(0.51 0.096 186);
            --primary-foreground: oklch(0.985 0.002 185);
            --muted: oklch(0.47 0.02 205);
            --border: oklch(0.905 0.012 190);
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --background: oklch(0.17 0.014 215);
                --foreground: oklch(0.96 0.006 190);
                --primary: oklch(0.8 0.11 182);
                --primary-foreground: oklch(0.2 0.03 200);
                --muted: oklch(0.74 0.015 200);
                --border: oklch(0.31 0.016 210);
            }
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100svh;
            display: flex;
            flex-direction: column;
            background: var(--background);
            color: var(--foreground);
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            line-height: 1.5;
        }
        header { display: flex; align-items: center; gap: .5rem; padding: 1rem 1.5rem; font-size: .875rem; font-weight: 600; }
        header img { width: 2rem; height: 2rem; border-radius: .5rem; }
        main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 1rem 4rem; }
        .box { width: 100%; max-width: 28rem; text-align: center; }
        .code { font-size: 4.5rem; font-weight: 600; line-height: 1; margin: 0 0 1rem; color: var(--primary); opacity: .35; }
        .eyebrow { margin: 0; font-size: .75rem; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
        h1 { margin: .25rem 0 0; font-size: 1.5rem; font-weight: 600; text-wrap: balance; }
        p.message { margin: .75rem 0 0; color: var(--muted); text-wrap: pretty; }
        .actions { margin-top: 2rem; display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; }
        .button {
            display: inline-flex; align-items: center; justify-content: center;
            min-height: 2.5rem; padding: .5rem 1rem; border-radius: .5rem;
            font-size: .875rem; font-weight: 500; text-decoration: none;
            border: 1px solid var(--border); color: var(--foreground);
        }
        .button.primary { background: var(--primary); border-color: var(--primary); color: var(--primary-foreground); }
        .button:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
        .note { margin-top: 1.5rem; font-size: .8125rem; color: var(--muted); }
        .note a { color: inherit; }
    </style>
</head>
<body>
    <header>
        @if ($logo)
            <img src="{{ $logo }}" alt="" width="32" height="32">
        @endif
        <span>{{ $brandName }}</span>
    </header>

    <main>
        <div class="box">
            <p class="code" aria-hidden="true">{{ $status }}</p>
            <p class="eyebrow">Error {{ $status }}</p>
            <h1>{{ $content['title'] }}</h1>
            <p class="message">{{ $content['message'] }}</p>

            <div class="actions">
                @if ($content['retry'])
                    <a class="button primary" href="">Volver a intentarlo</a>
                    <a class="button" href="/dashboard">Ir al inicio</a>
                @else
                    <a class="button primary" href="/dashboard">Ir al inicio</a>
                @endif
            </div>

            @if ($status === 503)
                <p class="note">
                    Esta página se actualiza sola cada minuto. Si tienes la app
                    instalada, mientras tanto puedes consultar tus datos en el
                    <a href="/offline">modo sin conexión</a>.
                </p>
            @endif
        </div>
    </main>
</body>
</html>
