<?php

namespace App\Enums;

/**
 * Estados de la mascota (CONTEXT.md §9). «cover» es la imagen de
 * presentación del catálogo, no un estado de ánimo.
 */
enum MascotState: string
{
    case Cover = 'cover';
    case Idle = 'idle';
    case Welcome = 'welcome';
    case Celebration = 'celebration';
    case Attention = 'attention';
    case Support = 'support';
    case Unknown = 'unknown';

    public function label(): string
    {
        return match ($this) {
            self::Cover => 'Imagen de presentación',
            self::Idle => 'Reposo',
            self::Welcome => 'Bienvenida',
            self::Celebration => 'Celebración',
            self::Attention => 'Atención',
            self::Support => 'Acompañamiento',
            self::Unknown => 'Sin información',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Cover => 'Se muestra en el catálogo al elegir mascota.',
            self::Idle => 'Estado habitual: respirar o parpadear suavemente.',
            self::Welcome => 'Saludo breve al entrar.',
            self::Celebration => 'Gesto alegre al alcanzar una meta o un hito confirmado.',
            self::Attention => 'Gesto atento y curioso cuando el margen previsto es reducido.',
            self::Support => 'Expresión cercana y tranquila ante un déficit o dificultad prevista.',
            self::Unknown => 'Esperar o pensar cuando faltan datos o están desactualizados.',
        };
    }

    /** Obligatorias para publicar; el resto usa la de reposo si falta. */
    public function isRequired(): bool
    {
        return $this === self::Cover || $this === self::Idle;
    }

    /**
     * Estados de ánimo (sin la imagen de presentación).
     *
     * @return list<self>
     */
    public static function moods(): array
    {
        return array_values(array_filter(self::cases(), fn (self $state) => $state !== self::Cover));
    }
}
