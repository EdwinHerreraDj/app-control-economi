<?php

namespace App\Mascots;

/**
 * Rellena las plantillas de mensajes. Solo sustituye las variables
 * permitidas; cualquier otra «{...}» se elimina, para que una plantilla
 * nunca muestre datos que no le corresponden.
 */
final class MessageRenderer
{
    /** Variables admitidas y su descripción (se muestran en el editor). */
    public const VARIABLES = [
        'nombre' => 'Nombre de pila del usuario',
        'mascota' => 'Nombre de la mascota',
        'fecha' => 'Fecha relevante (p. ej., del punto más bajo previsto)',
        'faltante' => 'Importe que faltaría según la previsión',
        'saldo_minimo' => 'Saldo más bajo previsto',
        'objetivo' => 'Objetivo de ahorro alcanzado',
    ];

    /**
     * @param  array<string, string|null>  $values
     */
    public function render(string $template, array $values): string
    {
        $text = preg_replace_callback('/\{([a-z_]+)\}/', function (array $match) use ($values) {
            $key = $match[1];

            return array_key_exists($key, self::VARIABLES) ? (string) ($values[$key] ?? '') : '';
        }, $template);

        // Limpia espacios dobles o ante signos si una variable quedó vacía.
        return trim((string) preg_replace(['/\s{2,}/', '/\s+([,.;:!?])/'], [' ', '$1'], (string) $text));
    }

    /**
     * Variables desconocidas en una plantilla (para validar el editor).
     *
     * @return list<string>
     */
    public function unknownVariables(string $template): array
    {
        preg_match_all('/\{([^}]*)\}/', $template, $matches);

        return array_values(array_diff(array_unique($matches[1]), array_keys(self::VARIABLES)));
    }
}
