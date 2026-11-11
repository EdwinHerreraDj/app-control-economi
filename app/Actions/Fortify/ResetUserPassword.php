<?php

namespace App\Actions\Fortify;

use App\Actions\Users\ActivateAccount;
use App\Concerns\PasswordValidationRules;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    use PasswordValidationRules;

    public function __construct(private readonly ActivateAccount $activateAccount) {}

    /**
     * Validate and reset the user's forgotten password.
     *
     * Un invitado que usa "¿Olvidaste tu contraseña?" en lugar del enlace de
     * invitación también demuestra que el correo es suyo: se activa igual.
     * Una cuenta suspendida cambia la contraseña pero sigue sin poder entrar.
     *
     * @param  array<string, string>  $input
     */
    public function reset(User $user, array $input): void
    {
        Validator::make($input, [
            'password' => $this->passwordRules(),
        ])->validate();

        if ($user->isPending()) {
            $this->activateAccount->handle($user, $input['password']);

            return;
        }

        $user->forceFill([
            'password' => $input['password'],
        ])->save();

        AuditLog::record('user.password_reset', $user, actor: $user);
    }
}
