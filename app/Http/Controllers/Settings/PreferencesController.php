<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Users\UpdatePreferences;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PreferencesRequest;
use App\Support\FinancialFootprint;
use App\Support\PreferenceOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PreferencesController extends Controller
{
    public function edit(Request $request, FinancialFootprint $footprint): Response
    {
        return Inertia::render('settings/preferences', [
            'options' => PreferenceOptions::all(),
            'canChangeCurrency' => ! $footprint->hasRecords($request->user()),
        ]);
    }

    public function update(PreferencesRequest $request, UpdatePreferences $updatePreferences): RedirectResponse
    {
        $updatePreferences->handle(
            $request->user(),
            $request->validated('currency'),
            $request->validated('number_locale'),
            $request->validated('timezone'),
            $request->validated('locale'),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Preferencias guardadas.']);

        return back();
    }
}
