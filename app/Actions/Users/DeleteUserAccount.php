<?php

namespace App\Actions\Users;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Elimina un usuario y todos sus datos personales.
 *
 * Las cuentas y categorías están protegidas (ON DELETE RESTRICT) para que
 * nunca se pierda el historial al borrar una suelta; por eso, al eliminar
 * el usuario, sus datos se borran explícitamente y en orden: primero lo que
 * depende de cuentas y categorías, después ellas y por último el usuario.
 */
class DeleteUserAccount
{
    /** Tablas personales, de las más dependientes a las menos. */
    private const TABLES = [
        'transactions',
        'debt_payments',
        'transfers',
        'recurring_rules',
        'budgets',
        'savings_contributions',
        'savings_goals',
        'debts',
        'categories',
        'accounts',
    ];

    public function handle(User $user): void
    {
        DB::transaction(function () use ($user) {
            foreach (self::TABLES as $table) {
                DB::table($table)->where('user_id', $user->getKey())->delete();
            }

            if (config('session.driver') === 'database') {
                DB::connection(config('session.connection'))
                    ->table(config('session.table', 'sessions'))
                    ->where('user_id', $user->getKey())
                    ->delete();
            }

            $user->delete();
        });
    }
}
