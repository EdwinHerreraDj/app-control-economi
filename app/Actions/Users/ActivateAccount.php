<?php

namespace App\Actions\Users;

use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;

class ActivateAccount
{
    /**
     * Completa el alta de un usuario invitado: haber recibido el enlace en su
     * correo demuestra que la dirección es suya, así que queda verificada.
     */
    public function handle(User $user, #[\SensitiveParameter] string $password): void
    {
        $user->forceFill([
            'password' => $password,
            'status' => UserStatus::Active,
            'activated_at' => now(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        AuditLog::record('user.activated', $user, actor: $user);
    }
}
