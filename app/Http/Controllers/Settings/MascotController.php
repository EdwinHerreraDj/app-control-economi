<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Mascots\MascotCompanion;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Preferencias de la mascota de cada usuario.
 *
 * La mascota, su nombre y sus mensajes los decide el superusuario. Cada
 * persona solo ajusta lo que afecta a su accesibilidad y comodidad:
 * mostrarla, minimizarla u ocultarla, y reducir sus animaciones.
 */
class MascotController extends Controller
{
    public function edit(Request $request, MascotCompanion $companion): Response
    {
        /** @var User $user */
        $user = $request->user();
        $mascot = $companion->mascotFor($user);

        return Inertia::render('settings/mascot', [
            'mascot' => $mascot === null ? null : [
                'name' => $mascot->name,
                'description' => $mascot->description,
                'images' => $mascot->images(),
            ],
            'settings' => [
                'mascot_visibility' => $user->mascot_visibility,
                'mascot_motion' => $user->mascot_motion,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'mascot_visibility' => ['required', Rule::in(['shown', 'minimized', 'hidden'])],
            'mascot_motion' => ['required', Rule::in(['full', 'reduced', 'none'])],
        ], attributes: [
            'mascot_visibility' => 'visibilidad',
            'mascot_motion' => 'animaciones',
        ]);

        $request->user()->forceFill($validated)->save();
        $this->toast('Preferencias de la mascota guardadas.');

        return back();
    }

    /** Minimizar, mostrar u ocultar desde el propio panel. */
    public function visibility(Request $request): RedirectResponse
    {
        $validated = $request->validate(['mascot_visibility' => ['required', Rule::in(['shown', 'minimized', 'hidden'])]]);
        $request->user()->forceFill($validated)->save();

        if ($validated['mascot_visibility'] === 'hidden') {
            $this->toast('Mascota oculta. Puedes recuperarla en Configuración → Mascota.');
        }

        return back();
    }
}
