<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Aplica el idioma elegido por el usuario a los textos del servidor
 * (validación, correos...). Las fechas se guardan siempre en UTC y se
 * muestran en la zona horaria del usuario desde la interfaz.
 */
class SetUserLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->user()?->locale;

        if ($locale !== null && array_key_exists($locale, config('money.locales'))) {
            app()->setLocale($locale);
        }

        return $next($request);
    }
}
