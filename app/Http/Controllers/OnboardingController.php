<?php

namespace App\Http\Controllers;

use App\Actions\Users\UpdatePreferences;
use App\Http\Requests\Settings\PreferencesRequest;
use App\Support\PreferenceOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Primera configuración tras activar la cuenta: moneda, formato y zona horaria.
 */
class OnboardingController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        if ($request->user()->hasCompletedOnboarding()) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('onboarding', [
            'options' => PreferenceOptions::all(),
        ]);
    }

    public function store(PreferencesRequest $request, UpdatePreferences $updatePreferences): RedirectResponse
    {
        $updatePreferences->handle(
            $request->user(),
            $request->validated('currency'),
            $request->validated('number_locale'),
            $request->validated('timezone'),
            $request->validated('locale'),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => '¡Todo listo! Ya puedes empezar a organizar tus cuentas.']);

        return redirect()->route('dashboard');
    }
}
