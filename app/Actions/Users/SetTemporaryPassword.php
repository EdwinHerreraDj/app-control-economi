<?php

namespace App\Actions\Users;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\AccountChangedByAdministrator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Altas y contraseñas puestas por el superusuario, sin enviar correos.
 *
 * La contraseña es siempre temporal: al iniciar sesión, la persona debe
 * elegir la suya antes de usar la aplicación. Nunca se guarda en claro ni
 * aparece en la auditoría.
 */
class SetTemporaryPassword
{
    /**
     * Crea una cuenta ya activa con una contraseña temporal.
     */
    public function create(string $name, string $email, UserRole $role, #[\SensitiveParameter] string $password): User
    {
        return DB::transaction(function () use ($name, $email, $role, $password) {
            $user = new User(['name' => $name, 'email' => $email, 'password' => $password]);
            $user->forceFill([
                'role' => $role,
                'status' => UserStatus::Active,
                'must_change_password' => true,
                'activated_at' => now(),
                // El superusuario da de alta la dirección: no se pide verificarla.
                'email_verified_at' => now(),
            ])->save();

            AuditLog::record('user.created_with_password', $user, ['role' => $role->value]);

            return $user;
        });
    }

    /**
     * Pone una contraseña temporal a una cuenta existente (por ejemplo, si
     * no puede recuperar la suya por correo) y cierra todas sus sesiones.
     */
    public function reset(User $actor, User $user, #[\SensitiveParameter] string $password): void
    {
        if ($actor->is($user)) {
            throw ValidationException::withMessages([
                'password' => 'Para cambiar tu propia contraseña usa Configuración → Seguridad.',
            ]);
        }

        if ($user->status === UserStatus::Suspended) {
            throw ValidationException::withMessages([
                'password' => 'La cuenta está suspendida. Reactívala antes de ponerle una contraseña.',
            ]);
        }

        // Solo se avisa a quien ya usaba la cuenta (una invitada aún no tiene nada).
        $wasActivated = $user->activated_at !== null;

        DB::transaction(function () use ($user, $password, $wasActivated) {
            $user->forceFill([
                'password' => $password,
                'must_change_password' => true,
                'remember_token' => Str::random(60),
                // Una cuenta invitada que recibe contraseña queda activa.
                'status' => UserStatus::Active,
                'activated_at' => $user->activated_at ?? now(),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();

            if (config('session.driver') === 'database') {
                DB::connection(config('session.connection'))
                    ->table(config('session.table', 'sessions'))
                    ->where('user_id', $user->getKey())
                    ->delete();
            }

            AuditLog::record('user.temporary_password_set', $user);

            // El titular siempre se entera de que alguien puede entrar en su cuenta.
            if ($wasActivated) {
                DB::afterCommit(fn () => $user->notify(new AccountChangedByAdministrator('temporary_password', $user->name)));
            }
        });
    }

    /**
     * La persona elige su propia contraseña tras entrar con la temporal.
     */
    public function replaceWithOwn(User $user, #[\SensitiveParameter] string $password): void
    {
        $user->forceFill([
            'password' => $password,
            'must_change_password' => false,
        ])->save();

        AuditLog::record('user.password_chosen', $user, actor: $user);
    }
}
