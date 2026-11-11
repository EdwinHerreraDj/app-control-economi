<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Users\ActivateAccount;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Models\User;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class InvitationController extends Controller
{
    /**
     * Formulario para que el invitado establezca su contraseña.
     */
    public function show(Request $request, string $token): Response
    {
        $email = Str::lower((string) $request->query('email'));
        $user = $this->findInvitedUser($email, $token);

        return Inertia::render('auth/accept-invitation', [
            'token' => $token,
            'email' => $email,
            'name' => $user?->name,
            'valid' => $user !== null,
            'passwordRules' => PasswordRule::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(AcceptInvitationRequest $request, ActivateAccount $activateAccount): RedirectResponse
    {
        $user = $this->findInvitedUser(Str::lower($request->validated('email')), $request->validated('token'));

        if ($user === null) {
            throw ValidationException::withMessages([
                'email' => 'El enlace de invitación no es válido o ha caducado. Pide al administrador que te envíe uno nuevo.',
            ]);
        }

        $activateAccount->handle($user, $request->validated('password'));
        $this->broker()->deleteToken($user);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        Inertia::flash('toast', ['type' => 'success', 'message' => '¡Tu cuenta está activa! Te damos la bienvenida.']);

        return redirect()->route('dashboard');
    }

    private function findInvitedUser(string $email, string $token): ?User
    {
        if ($email === '') {
            return null;
        }

        $user = User::query()->where('email', $email)->first();

        if ($user === null || ! $user->isPending() || ! $this->broker()->tokenExists($user, $token)) {
            return null;
        }

        return $user;
    }

    private function broker(): PasswordBroker
    {
        /** @var PasswordBroker */
        return Password::broker('invitations');
    }
}
