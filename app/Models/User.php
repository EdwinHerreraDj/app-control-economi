<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Carbon\CarbonImmutable;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * El rol y el estado no son asignables en masa: solo se modifican mediante
 * las acciones de App\Actions\Users, que aplican las reglas de negocio
 * (por ejemplo, no dejar la aplicación sin superusuarios activos).
 *
 * @property UserRole $role
 * @property UserStatus $status
 * @property CarbonImmutable|null $email_verified_at
 * @property CarbonImmutable|null $invited_at
 * @property CarbonImmutable|null $activated_at
 * @property CarbonImmutable|null $suspended_at
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
            'invited_at' => 'datetime',
            'activated_at' => 'datetime',
            'suspended_at' => 'datetime',
        ];
    }

    public function isSuperuser(): bool
    {
        return $this->role === UserRole::Superuser;
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function isPending(): bool
    {
        return $this->status === UserStatus::Pending;
    }

    /**
     * @param  Builder<User>  $query
     */
    public function scopeActiveSuperusers(Builder $query): void
    {
        $query->where('role', UserRole::Superuser)->where('status', UserStatus::Active);
    }
}
