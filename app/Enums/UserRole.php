<?php

namespace App\Enums;

enum UserRole: string
{
    case Superuser = 'superuser';
    case User = 'user';

    public function label(): string
    {
        return match ($this) {
            self::Superuser => 'Superusuario',
            self::User => 'Usuario',
        };
    }
}
