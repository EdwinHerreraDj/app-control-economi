<?php

namespace App\Support;

use App\Models\User;

/**
 * Indica si un usuario tiene ya información financiera registrada.
 *
 * Se usa para decidir si puede cambiar libremente su moneda principal: con
 * datos existentes no se permite, para no reinterpretar importes históricos.
 *
 * Cada módulo financiero que guarde importes (cuentas, movimientos, deudas,
 * presupuestos, objetivos...) debe añadirse aquí cuando se implemente.
 */
class FinancialFootprint
{
    public function hasRecords(User $user): bool
    {
        // Todavía no existe ningún módulo financiero (llegan en la fase 4).
        return false;
    }
}
