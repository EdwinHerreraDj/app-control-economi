<?php

namespace App\Support;

use DateTimeZone;

/**
 * Opciones de los selectores de preferencias, en el formato que usa la interfaz.
 */
class PreferenceOptions
{
    /**
     * @return array{
     *     currencies: list<array{code: string, name: string, decimals: int}>,
     *     numberLocales: list<array{value: string, label: string}>,
     *     timezones: list<string>,
     *     locales: list<array{value: string, label: string}>
     * }
     */
    public static function all(): array
    {
        /** @var array<string, array{name: string, decimals: int}> $currencies */
        $currencies = config('money.currencies');
        /** @var array<string, string> $numberLocales */
        $numberLocales = config('money.number_locales');
        /** @var array<string, string> $locales */
        $locales = config('money.locales');

        return [
            'currencies' => array_map(
                fn (string $code, array $currency) => ['code' => $code, 'name' => $currency['name'], 'decimals' => $currency['decimals']],
                array_keys($currencies),
                $currencies,
            ),
            'numberLocales' => self::pairs($numberLocales),
            'timezones' => DateTimeZone::listIdentifiers(),
            'locales' => self::pairs($locales),
        ];
    }

    /**
     * @param  array<string, string>  $options
     * @return list<array{value: string, label: string}>
     */
    private static function pairs(array $options): array
    {
        return array_map(
            fn (string $value, string $label) => ['value' => $value, 'label' => $label],
            array_keys($options),
            $options,
        );
    }
}
