<?php

namespace App\Actions\Users;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InviteUser
{
    public function __construct(private readonly SendInvitation $sendInvitation) {}

    /**
     * Da de alta un usuario sin contraseña y le envía el enlace de activación.
     */
    public function handle(string $name, string $email, UserRole $role = UserRole::User): User
    {
        $user = DB::transaction(function () use ($name, $email, $role) {
            $user = new User(['name' => $name, 'email' => $email]);
            $user->forceFill([
                'role' => $role,
                'status' => UserStatus::Pending,
            ])->save();

            AuditLog::record('user.created', $user, ['role' => $role->value]);

            return $user;
        });

        $this->sendInvitation->handle($user);

        return $user;
    }
}
