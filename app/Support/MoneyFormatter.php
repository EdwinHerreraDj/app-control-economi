<?php

namespace App\Support;

use App\Models\User;
use Carbon\CarbonImmutable;
use IntlDateFormatter;
use NumberFormatter;

/**
 * Formato de importes y fechas para los textos que redacta el servidor
 * (explicaciones del panel, mensajes de la mascota...), con las mismas
 * preferencias que usa la interfaz.
 */
final class MoneyFormatter
{
    public function __construct(private readonly User $user) {}

    public static function for(User $user): self
    {
        return new self($user);
    }

    public function money(int $minor, ?string $currency = null): string
    {
        $currency ??= (string) $this->user->currency;
        $decimals = Money::decimals($currency);

        $formatter = new NumberFormatter(str_replace('-', '_', $this->user->number_locale), NumberFormatter::CURRENCY);
        $formatter->setAttribute(NumberFormatter::MIN_FRACTION_DIGITS, $decimals);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, $decimals);

        // Se formatea desde el texto decimal exacto, no desde un float calculado.
        $formatted = $formatter->formatCurrency((float) Money::toDecimal($minor, $currency), $currency);

        return $formatted === false ? Money::toDecimal($minor, $currency).' '.$currency : $formatted;
    }

    /** «30 de noviembre». */
    public function day(CarbonImmutable $date): string
    {
        // El texto sigue el idioma de la interfaz, no el formato numérico.
        $formatter = new IntlDateFormatter(
            $this->user->locale,
            IntlDateFormatter::NONE,
            IntlDateFormatter::NONE,
            'UTC',
            null,
            "d 'de' MMMM",
        );

        return (string) $formatter->format($date->setTime(12, 0)->utc());
    }
}
