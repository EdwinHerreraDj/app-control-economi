<?php

namespace App\Enums;

use Carbon\CarbonImmutable;

enum Frequency: string
{
    case Weekly = 'weekly';
    case Biweekly = 'biweekly';
    case Monthly = 'monthly';
    case Bimonthly = 'bimonthly';
    case Quarterly = 'quarterly';
    case Semiannual = 'semiannual';
    case Yearly = 'yearly';

    public function label(): string
    {
        return match ($this) {
            // Lenguaje cotidiano: «cada mes» se entiende mejor que «mensual».
            self::Weekly => 'Cada semana',
            self::Biweekly => 'Cada 2 semanas',
            self::Monthly => 'Cada mes',
            self::Bimonthly => 'Cada 2 meses',
            self::Quarterly => 'Cada 3 meses',
            self::Semiannual => 'Cada 6 meses',
            self::Yearly => 'Cada año',
        };
    }

    /**
     * Fecha de la ocurrencia número $n (0 = la inicial).
     *
     * Se calcula siempre desde la fecha inicial para no acumular desvíos:
     * un cargo el día 31 cae el último día de los meses más cortos y
     * vuelve al 31 en los meses que lo tienen.
     */
    public function occurrence(CarbonImmutable $start, int $n): CarbonImmutable
    {
        return match ($this) {
            self::Weekly => $start->addWeeks($n),
            self::Biweekly => $start->addWeeks(2 * $n),
            self::Monthly => $start->addMonthsNoOverflow($n),
            self::Bimonthly => $start->addMonthsNoOverflow(2 * $n),
            self::Quarterly => $start->addMonthsNoOverflow(3 * $n),
            self::Semiannual => $start->addMonthsNoOverflow(6 * $n),
            self::Yearly => $start->addYearsNoOverflow($n),
        };
    }

    /** Siguiente fecha tras $date, contando desde el inicio del calendario. */
    public function nextAfter(CarbonImmutable $start, CarbonImmutable $date): CarbonImmutable
    {
        for ($n = 0; $n < 5000; $n++) {
            $candidate = $this->occurrence($start, $n);

            if ($candidate->greaterThan($date)) {
                return $candidate;
            }
        }

        return $date->addDay();
    }
}
