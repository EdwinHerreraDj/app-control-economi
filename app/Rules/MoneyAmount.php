<?php

namespace App\Rules;

use App\Support\Money;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

/**
 * Valida un importe en texto para una moneda concreta.
 */
class MoneyAmount implements ValidationRule
{
    public function __construct(
        private readonly string $currency,
        private readonly bool $allowNegative = false,
        private readonly bool $allowZero = false,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) && ! is_int($value)) {
            $fail('El :attribute debe ser un importe.');

            return;
        }

        try {
            $minor = Money::toMinor((string) $value, $this->currency, $this->allowNegative);
        } catch (InvalidArgumentException) {
            $decimals = Money::decimals($this->currency);
            $fail($decimals > 0
                ? "El :attribute no es válido. Usa como máximo {$decimals} decimales."
                : 'El :attribute no es válido. Esta moneda no usa decimales.');

            return;
        }

        if ($minor === 0 && ! $this->allowZero) {
            $fail('El :attribute debe ser mayor que cero.');
        }
    }
}
