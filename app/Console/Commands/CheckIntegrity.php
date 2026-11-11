<?php

namespace App\Console\Commands;

use App\Finance\IntegrityChecker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Comprobación periódica de los invariantes financieros. Repetirla es seguro:
 * solo lee.
 */
class CheckIntegrity extends Command
{
    protected $signature = 'app:check-integrity';

    protected $description = 'Comprueba la coherencia de los datos financieros (propiedad, monedas, transferencias y pagos de deuda)';

    public function handle(IntegrityChecker $checker): int
    {
        $results = $checker->run();
        $problems = 0;

        $this->table(['Comprobación', 'Incidencias', 'Ids afectados'], array_map(
            function (array $check) use (&$problems) {
                $problems += count($check['ids']);

                return [
                    $check['label'],
                    count($check['ids']) === 0 ? 'OK' : count($check['ids']),
                    implode(', ', array_slice($check['ids'], 0, 20)).(count($check['ids']) > 20 ? '…' : ''),
                ];
            },
            array_values($results),
        ));

        if ($problems === 0) {
            $this->components->info('Los datos financieros son coherentes.');

            return self::SUCCESS;
        }

        // Solo identificadores: el registro no debe contener datos financieros.
        Log::warning('Comprobación de integridad con incidencias', array_map(
            fn (array $check) => $check['ids'],
            array_filter($results, fn (array $check) => $check['ids'] !== []),
        ));

        $this->components->error("Se han encontrado {$problems} incidencias. Revisa los identificadores indicados.");

        return self::FAILURE;
    }
}
