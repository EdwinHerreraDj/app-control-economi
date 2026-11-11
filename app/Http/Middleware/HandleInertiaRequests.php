<?php

namespace App\Http\Middleware;

use App\Branding\Brand;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $brand = app(Brand::class)->resolved();

        return [
            ...parent::share($request),
            'name' => $brand['name'],
            // Identidad visual configurable por el superusuario.
            'brand' => [
                'name' => $brand['name'],
                'short_name' => $brand['short_name'],
                'logo' => $brand['custom']['logo'] ? $brand['urls']['logo'] : null,
                'logo_dark' => $brand['custom']['logo_dark'] ? $brand['urls']['logo_dark'] : null,
                'logo_square' => $brand['custom']['logo_square'] ? $brand['urls']['logo_square'] : null,
            ],
            // Formato de importes y fechas del usuario (o por defecto, sin sesión).
            'preferences' => $request->user()?->preferences() ?? [
                'currency' => null,
                'currency_decimals' => null,
                'number_locale' => 'es-ES',
                'timezone' => config('app.timezone'),
                'locale' => app()->getLocale(),
            ],
            'auth' => [
                'user' => $request->user(),
                'can' => [
                    'administer' => $request->user()?->can('administer') ?? false,
                ],
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
