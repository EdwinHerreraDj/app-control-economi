<?php

namespace App\Enums;

enum TransactionStatus: string
{
    /** Previsto: no modifica el saldo real hasta confirmarse. */
    case Planned = 'planned';

    /** Cobrado, pagado o realizado: forma parte del saldo real. */
    case Confirmed = 'confirmed';
}
