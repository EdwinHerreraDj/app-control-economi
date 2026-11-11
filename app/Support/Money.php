<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Conversión entre importes decimales (texto) y enteros en unidad menor.
 *
 * Nunca usa coma flotante: trabaja con cadenas y enteros de 64 bits.
 * Ejemplo con EUR (2 decimales): "1234.5" ⇄ 123450.
 */
final class Money
{
    /** Máximo de dígitos enteros admitidos (cabe de sobra en un bigint). */
    private const MAX_INTEGER_DIGITS = 13;

    public static function decimals(string $currency): int
    {
        return (int) config("money.currencies.{$currency}.decimals", 2);
    }

    /**
     * Convierte "1234.56" (o "1234,56") a unidades menores.
     *
     * No admite separadores de miles: la interfaz los elimina antes de
     * enviar, para no confundir «1.234» (mil) con «1,234» (uno con decimales).
     *
     * @throws InvalidArgumentException si el texto no es un importe válido.
     */
    public static function toMinor(string $amount, string $currency, bool $allowNegative = false): int
    {
        $value = str_replace([' ', "\u{00A0}", "\u{202F}"], '', trim($amount));

        if (str_contains($value, '.') && str_contains($value, ',')) {
            throw new InvalidArgumentException('Usa un único separador decimal.');
        }

        $value = str_replace(',', '.', $value);
        $decimals = self::decimals($currency);
        $pattern = $decimals > 0
            ? '/^(-?)(\d{1,'.self::MAX_INTEGER_DIGITS.'})(?:\.(\d{1,'.$decimals.'}))?$/'
            : '/^(-?)(\d{1,'.self::MAX_INTEGER_DIGITS.'})$/';

        if (! preg_match($pattern, $value, $matches)) {
            throw new InvalidArgumentException('Importe no válido.');
        }

        [, $sign, $integer] = $matches;

        if ($sign === '-' && ! $allowNegative) {
            throw new InvalidArgumentException('El importe no puede ser negativo.');
        }

        $fraction = str_pad($matches[3] ?? '', $decimals, '0');
        $minor = (int) ltrim($integer.$fraction, '0');

        return $sign === '-' ? -$minor : $minor;
    }

    /**
     * Convierte unidades menores al texto decimal que recibe la interfaz.
     */
    public static function toDecimal(int $minor, string $currency): string
    {
        $decimals = self::decimals($currency);
        $sign = $minor < 0 ? '-' : '';
        $digits = str_pad((string) abs($minor), $decimals + 1, '0', STR_PAD_LEFT);

        if ($decimals === 0) {
            return $sign.$digits;
        }

        return $sign.substr($digits, 0, -$decimals).'.'.substr($digits, -$decimals);
    }
}
