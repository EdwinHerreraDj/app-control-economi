<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Quien entra con una contraseña temporal puesta por el superusuario debe
 * elegir la suya antes de usar cualquier otra parte de la aplicación.
 */
class EnsurePasswordChanged
{
    /** Rutas permitidas mientras tanto. */
    private const ALLOWED = ['password.choose', 'password.choose.store', 'logout'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->must_change_password && ! $request->routeIs(...self::ALLOWED)) {
            return redirect()->route('password.choose');
        }

        return $next($request);
    }
}
