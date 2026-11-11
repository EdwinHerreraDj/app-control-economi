<?php

namespace App\Enums;

enum AccountType: string
{
    case Bank = 'bank';
    case Savings = 'savings';
    case Cash = 'cash';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Bank => 'Cuenta bancaria',
            self::Savings => 'Cuenta de ahorro',
            self::Cash => 'Efectivo',
            self::Other => 'Otro depósito',
        };
    }
}
