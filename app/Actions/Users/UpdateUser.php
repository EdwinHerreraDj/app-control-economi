<?php

namespace App\Actions\Users;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateUser
{
    public function __construct(private readonly EnsureSuperuserRemains $ensureSuperuserRemains) {}

    public function handle(User $actor, User $user, string $name, string $email, UserRole $role): User
    {
        DB::transaction(function () use ($actor, $user, $name, $email, $role) {
            if ($user->role !== $role) {
                if ($actor->is($user)) {
                    throw ValidationException::withMessages([
                        'role' => 'No puedes cambiar el rol de tu propia cuenta.',
                    ]);
                }

                if ($role !== UserRole::Superuser) {
                    $this->ensureSuperuserRemains->check($user, 'role');
                }
            }

            $changes = [];
            foreach (['name' => $name, 'email' => $email] as $field => $value) {
                if ($user->{$field} !== $value) {
                    $changes[] = $field;
                }
            }
            if ($user->role !== $role) {
                $changes[] = 'role';
            }

            $emailChanged = $user->email !== $email;

            $user->fill(['name' => $name, 'email' => $email]);
            $user->forceFill(['role' => $role]);

            // Una cuenta activa con correo nuevo debe volver a verificarlo.
            if ($emailChanged && ! $user->isPending()) {
                $user->forceFill(['email_verified_at' => null]);
            }

            $user->save();

            if ($changes !== []) {
                AuditLog::record('user.updated', $user, ['fields' => $changes]);
            }

            if ($emailChanged && ! $user->isPending()) {
                DB::afterCommit(fn () => $user->sendEmailVerificationNotification());
            }
        });

        return $user;
    }
}
