<?php

use App\Http\ErrorResponder;
use App\Http\Middleware\EnsureOnboardingCompleted;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetUserLocale;
use App\Http\Middleware\ThrottlePasswordResetRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\AuthenticateSession;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'onboarded' => EnsureOnboardingCompleted::class,
        ]);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Cabeceras de seguridad y CSP también en respuestas JSON y estáticas.
        $middleware->append(SecurityHeaders::class);

        $middleware->web(append: [
            // Invalida las sesiones de otros dispositivos cuando cambia la
            // contraseña o el usuario cierra las demás sesiones.
            AuthenticateSession::class,
            EnsureUserIsActive::class,
            EnsurePasswordChanged::class,
            SetUserLocale::class,
            ThrottlePasswordResetRequests::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Páginas de error propias (404, 403, 500, mantenimiento…).
        $exceptions->respond(
            fn (Response $response, Throwable $exception, Request $request) => app(ErrorResponder::class)->handle($response, $request),
        );
    })->create();
