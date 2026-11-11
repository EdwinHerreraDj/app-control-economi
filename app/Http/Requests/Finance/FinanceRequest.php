<?php

namespace App\Http\Requests\Finance;

use App\Models\User;
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
