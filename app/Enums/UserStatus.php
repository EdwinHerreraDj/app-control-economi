<?php

namespace App\Enums;

enum UserStatus: string
{
    /** Invitado por el superusuario; todavía no ha establecido su contraseña. */
    case Pending = 'pending';

    case Active = 'active';

    /** No puede iniciar sesión; sus sesiones abiertas se cierran. */
    case Suspended = 'suspended';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendiente de activar',
            self::Active => 'Activo',
            self::Suspended => 'Suspendido',
        };
    }
}
