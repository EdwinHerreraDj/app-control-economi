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
            self::Weekly => 'Semanal',
            self::Biweekly => 'Cada dos semanas',
            self::Monthly => 'Mensual',
            self::Bimonthly => 'Bimestral',
            self::Quarterly => 'Trimestral',
            self::Semiannual => 'Semestral',
            self::Yearly => 'Anual',
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
