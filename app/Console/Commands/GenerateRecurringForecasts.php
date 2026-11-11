<?php

namespace App\Console\Commands;

use App\Finance\RecurringGenerator;
use App\Models\RecurringRule;
use Illuminate\Console\Command;

/**
 * Mantiene al día las previsiones de las reglas recurrentes de todos los
 * usuarios. Se ejecuta a diario desde el scheduler; repetirlo es seguro.
 */
class GenerateRecurringForecasts extends Command
{
    protected $signature = 'app:generate-recurring';

    protected $description = 'Genera los movimientos previstos de las reglas recurrentes';

    public function handle(RecurringGenerator $generator): int
    {
        $created = 0;

        RecurringRule::query()
            ->whereNull('paused_at')
            ->with(['user', 'account'])
            ->chunkById(200, function ($rules) use ($generator, &$created) {
                foreach ($rules as $rule) {
                    $created += $generator->generate($rule);
                }
            });

        $this->components->info("Previsiones nuevas: {$created}.");

        return self::SUCCESS;
    }
}
