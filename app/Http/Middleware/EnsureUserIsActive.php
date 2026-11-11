<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cierra la sesión de una cuenta que deja de estar activa (por ejemplo, una
 * suspensión) aunque conserve una sesión abierta o una cookie de recuerdo.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && ! $user->isActive()) {
            Auth::guard('web')->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            // La sincronización sin conexión usa esta respuesta para borrar
            // los datos guardados en el dispositivo.
            if ($request->wantsJson() && ! $request->header('X-Inertia')) {
                return response()->json([
                    'code' => 'inactive',
                    'message' => 'La cuenta no está activa.',
                ], 403);
            }

            return redirect()->route('login')->with(
                'status',
                'Tu sesión se ha cerrado porque la cuenta no está activa.',
            );
        }

        return $next($request);
    }
}
