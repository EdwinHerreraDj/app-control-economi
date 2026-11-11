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
use Illuminate\Database\Eloquent\Relations\HasMany;
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
 * @property string|null $currency Moneda principal (ISO 4217); nula hasta la primera configuración.
 * @property string $number_locale Formato regional de importes y fechas (BCP 47).
 * @property string $timezone
 * @property string $locale Idioma de la interfaz.
 * @property CarbonImmutable|null $onboarded_at
 * @property bool $must_change_password Entró con una contraseña temporal del superusuario.
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
            'onboarded_at' => 'datetime',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * Ha completado la primera configuración (al menos, la moneda).
     */
    public function hasCompletedOnboarding(): bool
    {
        return $this->onboarded_at !== null && $this->currency !== null;
    }

    /**
     * Preferencias que necesita la interfaz para mostrar importes y fechas.
     *
     * @return array{currency: string|null, currency_decimals: int|null, number_locale: string, timezone: string, locale: string}
     */
    public function preferences(): array
    {
        return [
            'currency' => $this->currency,
            // Decimales de la unidad menor según nuestro catálogo (no los de
            // la configuración regional del navegador, que pueden diferir).
            'currency_decimals' => $this->currency !== null
                ? config("money.currencies.{$this->currency}.decimals")
                : null,
            'number_locale' => $this->number_locale,
            'timezone' => $this->timezone,
            'locale' => $this->locale,
        ];
    }

    /**
     * @return HasMany<Account, $this>
     */
    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class);
    }

    /**
     * @return HasMany<Category, $this>
     */
    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * @return HasMany<Transfer, $this>
     */
    public function transfers(): HasMany
    {
        return $this->hasMany(Transfer::class);
    }

    /**
     * @return HasMany<Debt, $this>
     */
    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    /**
     * @return HasMany<RecurringRule, $this>
     */
    public function recurringRules(): HasMany
    {
        return $this->hasMany(RecurringRule::class);
    }

    /**
     * @return HasMany<Budget, $this>
     */
    public function budgets(): HasMany
    {
        return $this->hasMany(Budget::class);
    }

    /**
     * @return HasMany<SavingsGoal, $this>
     */
    public function savingsGoals(): HasMany
    {
        return $this->hasMany(SavingsGoal::class);
    }

    /** Fecha de hoy en la zona horaria del usuario. */
    public function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->timezone)->startOfDay();
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
