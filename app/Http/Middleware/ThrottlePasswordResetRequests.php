<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Límite de peticiones de recuperación de contraseña (la ruta la define
 * Fortify sin límite): por IP y por dirección de correo. Al superarlo se
 * responde igual que siempre, sin enviar nada, para no revelar qué cuentas
 * existen ni permitir llenar buzones ajenos.
 */
class ThrottlePasswordResetRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('post') || ! $request->routeIs('password.email')) {
            return $next($request);
        }

        $email = Str::lower(trim((string) $request->input('email')));
        $keys = [
            'password-reset:ip:'.$request->ip() => [5, 60],
            'password-reset:email:'.sha1($email) => [3, 15 * 60],
        ];

        foreach ($keys as $key => [$attempts, $decay]) {
            if (RateLimiter::tooManyAttempts($key, $attempts)) {
                return $request->wantsJson()
                    ? response()->json(['message' => trans(Password::RESET_LINK_SENT)])
                    : back()->with('status', trans(Password::RESET_LINK_SENT));
            }
        }

        foreach ($keys as $key => [, $decay]) {
            RateLimiter::hit($key, $decay);
        }

        return $next($request);
    }
}
