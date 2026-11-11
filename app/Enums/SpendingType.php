<?php

namespace App\Enums;

/**
 * Clasificación opcional de un gasto, en palabras de la persona. Nunca es
 * obligatoria y no juzga: solo ayuda a ver en qué se va el dinero del mes.
 */
enum SpendingType: string
{
    case Need = 'need';
    case Treat = 'treat';
    case Habitual = 'habitual';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Need => 'Algo necesario',
            self::Treat => 'Un gusto que me di',
            self::Habitual => 'Un pago habitual',
            self::Other => 'Otro',
        };
    }
}
