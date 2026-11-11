<?php

namespace App\Support;

use App\Models\User;

/**
 * Indica si un usuario tiene ya información financiera registrada.
 *
 * Se usa para decidir si puede cambiar libremente su moneda principal: con
 * datos existentes no se permite, para no reinterpretar importes históricos.
 *
 * Cada módulo nuevo que guarde importes (deudas, presupuestos, objetivos...)
 * debe añadirse aquí cuando se implemente.
 */
class FinancialFootprint
{
    public function hasRecords(User $user): bool
    {
        return $user->accounts()->exists()
            || $user->transactions()->exists()
            || $user->transfers()->exists()
            || $user->debts()->exists()
            || $user->recurringRules()->exists()
            || $user->budgets()->exists()
            || $user->savingsGoals()->exists();
    }
}
