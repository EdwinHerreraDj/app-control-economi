<?php

namespace App\Http\Requests\Finance;

use App\Models\User;
use App\Support\Money;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/**
 * Base de las peticiones financieras: ayuda a validar que los recursos
 * referenciados (cuentas, categorías) pertenecen al usuario.
 */
abstract class FinanceRequest extends FormRequest
{
    protected function owner(): User
    {
        /** @var User */
        return $this->user();
    }

    protected function currency(): string
    {
        return (string) $this->owner()->currency;
    }

    /**
     * Importe validado en unidades menores (null si el campo viene vacío).
     */
    public function minor(string $field, bool $allowNegative = false): ?int
    {
        if (! $this->filled($field)) {
            return null;
        }

        return Money::toMinor($this->string($field)->toString(), $this->currency(), $allowNegative);
    }

    /**
     * Texto opcional ya recortado, o null si viene vacío.
     */
    public function optionalString(string $field): ?string
    {
        return $this->filled($field) ? $this->string($field)->toString() : null;
    }

    protected function ownedBy(string $table): Exists
    {
        return Rule::exists($table, 'id')->where('user_id', $this->owner()->getKey());
    }

    /**
     * Elimina espacios sobrantes en los textos libres.
     */
    protected function prepareForValidation(): void
    {
        foreach (['name', 'concept', 'notes', 'reason'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }
}
