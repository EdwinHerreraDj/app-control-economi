<?php

namespace App\Actions\Users;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Impide que la aplicación se quede sin ningún superusuario activo.
 *
 * Debe llamarse dentro de una transacción: bloquea las filas de los
 * superusuarios activos para evitar que dos peticiones simultáneas
 * degraden o suspendan a los dos últimos a la vez.
 */
class EnsureSuperuserRemains
{
    public function check(User $user, string $field = 'user'): void
    {
        if (! $user->isSuperuser() || ! $user->isActive()) {
            return;
        }

        $others = User::query()
            ->activeSuperusers()
            ->whereKeyNot($user->getKey())
            ->lockForUpdate()
            ->count();

        if ($others === 0) {
            throw ValidationException::withMessages([
                $field => 'Esta es la única cuenta de superusuario activa. Nombra a otro superusuario antes de hacer este cambio.',
            ]);
        }
    }
}
