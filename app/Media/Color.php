<?php

namespace App\Media;

/**
 * Utilidades de color para la identidad visual.
 */
final class Color
{
    /**
     * «#0f766e» → [15, 118, 110]. Valores fuera de formato cuentan como 0.
     *
     * @return array{0: int<0, 255>, 1: int<0, 255>, 2: int<0, 255>}
     */
    public static function rgb(string $hex): array
    {
        $hex = str_pad(substr(ltrim($hex, '#'), 0, 6), 6, '0');
        $channel = fn (int $offset): int => max(0, min(255, (int) hexdec(substr($hex, $offset, 2))));

        return [$channel(0), $channel(2), $channel(4)];
    }

    /** Contraste WCAG entre dos colores hexadecimales. */
    public static function contrast(string $a, string $b): float
    {
        $luminance = function (string $hex): float {
            [$r, $g, $b] = array_map(
                function (int $c): float {
                    $c /= 255;

                    return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
                },
                self::rgb($hex),
            );

            return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
        };

        [$l1, $l2] = [$luminance($a), $luminance($b)];

        return (max($l1, $l2) + 0.05) / (min($l1, $l2) + 0.05);
    }
}
