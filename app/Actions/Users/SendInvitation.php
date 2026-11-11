<?php

namespace App\Actions\Users;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\UserInvitation;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class SendInvitation
{
    /**
     * Genera un enlace nuevo (el anterior deja de ser válido) y lo envía por correo.
     */
    public function handle(User $user): void
    {
        if (! $user->isPending()) {
            throw ValidationException::withMessages([
                'user' => 'Solo se pueden enviar invitaciones a cuentas pendientes de activar.',
            ]);
        }

        $token = Password::broker('invitations')->createToken($user);

        $user->forceFill(['invited_at' => now()])->save();
        $user->notify(new UserInvitation($token));

        AuditLog::record('user.invitation_sent', $user);
    }
}
