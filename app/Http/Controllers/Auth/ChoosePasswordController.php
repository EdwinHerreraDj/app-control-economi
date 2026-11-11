<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Users\SetTemporaryPassword;
use App\Concerns\PasswordValidationRules;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Cambio obligatorio de la contraseña temporal en el primer inicio de sesión.
 */
class ChoosePasswordController extends Controller
{
    use PasswordValidationRules;

    public function show(Request $request): Response|RedirectResponse
    {
        if (! $request->user()->must_change_password) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('auth/choose-password', [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(Request $request, SetTemporaryPassword $passwords): RedirectResponse
    {
        $request->validate(
            ['password' => $this->passwordRules()],
            attributes: ['password' => 'contraseña'],
        );

        $password = $request->string('password')->toString();

        // La nueva no puede ser la temporal: esa la conoce el superusuario.
        if (Hash::check($password, (string) $request->user()->password)) {
            return back()->withErrors(['password' => 'Elige una contraseña distinta de la temporal.']);
        }

        $passwords->replaceWithOwn($request->user(), $password);

        // Mantiene esta sesión y la cookie de recuerdo válidas con la nueva contraseña.
        Auth::guard('web')->logoutOtherDevices($password);

        $this->toast('Contraseña guardada. Solo tú la conoces.');

        return redirect()->route('dashboard');
    }
}
