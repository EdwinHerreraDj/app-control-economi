<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeceras de seguridad de todas las respuestas.
 *
 * La política de contenido (CSP) solo permite recursos propios. Los scripts
 * necesitan el nonce de la petición; los estilos en línea se permiten porque
 * React los usa en atributos (gráficos, barras de progreso). Con el servidor
 * de desarrollo de Vite activo no se aplica: inyecta sus propios scripts.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = Vite::useCspNonce();

        /** @var Response $response */
        $response = $next($request);
        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        if ($request->isSecure() && app()->isProduction()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        if (! Vite::isRunningHot()) {
            $headers->set('Content-Security-Policy', implode('; ', [
                "default-src 'self'",
                "script-src 'self' 'nonce-{$nonce}'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "manifest-src 'self'",
                "worker-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
            ]));
        }

        return $response;
    }
}
