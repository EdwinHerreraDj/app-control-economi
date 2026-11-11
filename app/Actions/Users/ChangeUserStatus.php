<?php

namespace App\Actions\Users;

use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ChangeUserStatus
{
    public function __construct(private readonly EnsureSuperuserRemains $ensureSuperuserRemains) {}

    /**
     * Suspende la cuenta y revoca todos sus accesos: sesiones abiertas y
     * "mantener la sesión" en cualquier dispositivo.
     */
    public function suspend(User $actor, User $user): void
    {
        if ($actor->is($user)) {
            throw ValidationException::withMessages([
                'user' => 'No puedes suspender tu propia cuenta.',
            ]);
        }

        if ($user->status === UserStatus::Suspended) {
            return;
        }

        DB::transaction(function () use ($user) {
            $this->ensureSuperuserRemains->check($user);

            $user->forceFill([
                'status' => UserStatus::Suspended,
                'suspended_at' => now(),
                'remember_token' => Str::random(60),
            ])->save();

            if (config('session.driver') === 'database') {
                DB::connection(config('session.connection'))
                    ->table(config('session.table', 'sessions'))
                    ->where('user_id', $user->getKey())
                    ->delete();
            }

            AuditLog::record('user.suspended', $user);
        });
    }

    /**
     * Reactiva una cuenta suspendida. Si nunca llegó a establecer su
     * contraseña vuelve a quedar pendiente de activación.
     */
    public function reactivate(User $user): void
    {
        if ($user->status !== UserStatus::Suspended) {
            return;
        }

        $user->forceFill([
            'status' => $user->password === null ? UserStatus::Pending : UserStatus::Active,
            'suspended_at' => null,
        ])->save();

        AuditLog::record('user.reactivated', $user);
    }
}
