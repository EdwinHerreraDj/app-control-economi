<?php

namespace App\Http;

use App\Branding\Brand;
use App\Models\Mascot;
use App\Support\ErrorMessages;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Convierte los errores HTTP en páginas propias de la app.
 *
 * - Peticiones JSON (sincronización sin conexión): se dejan como están.
 * - 500 con APP_DEBUG activo: se deja la página de depuración.
 * - 503 (mantenimiento): vista estática, que no necesita base de datos.
 * - 419 al enviar un formulario: se vuelve atrás con un aviso.
 * - El resto: página de error de la app. Si no se puede mostrar (por
 *   ejemplo, sin base de datos), queda la vista estática de respaldo.
 */
class ErrorResponder
{
    public function __construct(private readonly Brand $brand) {}

    public function handle(Response $response, Request $request): Response
    {
        $status = $response->getStatusCode();
        $inertia = $request->hasHeader('X-Inertia');

        if (! in_array($status, ErrorMessages::HANDLED, true)
            || ($request->expectsJson() && ! $inertia)
            || ($status === 500 && config('app.debug'))) {
            return $response;
        }

        if ($status === 419 && $inertia) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'La página había caducado. Revisa los datos y vuelve a enviarlos.',
            ]);

            return back();
        }

        if ($status === 503) {
            // Inertia necesita una página completa: se recarga y se muestra
            // la vista estática de mantenimiento.
            return $inertia ? Inertia::location($request->fullUrl()) : $response;
        }

        try {
            return Inertia::render('error', $this->props($status))
                ->toResponse($request)
                ->setStatusCode($status);
        } catch (Throwable $exception) {
            // Se registra: la página propia no debería fallar nunca.
            report($exception);

            return $inertia ? Inertia::location($request->fullUrl()) : $response;
        }
    }

    /**
     * La página no depende de los datos compartidos (en una ruta inexistente
     * no se ejecuta el middleware que los prepara): lo necesario va aquí.
     *
     * @return array<string, mixed>
     */
    private function props(int $status): array
    {
        $content = ErrorMessages::for($status);
        $brand = $this->brand->resolved();

        try {
            $mascot = Mascot::default()?->load('assets');
            $image = $mascot?->images()[$content['mascot_state']]['static'] ?? null;
        } catch (Throwable) {
            $mascot = null;
            $image = null;
        }

        return [
            ...$content,
            'brand' => [
                'name' => $brand['name'],
                'logo' => $brand['urls']['logo_square'] ?? null,
            ],
            'mascot' => $image ? ['name' => $mascot?->name, 'image' => $image] : null,
        ];
    }
}
