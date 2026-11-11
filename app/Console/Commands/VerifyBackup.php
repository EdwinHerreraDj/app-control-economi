<?php

namespace App\Console\Commands;

use App\Backup\BackupManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Prueba de restauración: carga la copia en una base de datos temporal,
 * compara cada tabla con el manifiesto y comprueba el archivo de recursos.
 */
class VerifyBackup extends Command
{
    protected $signature = 'app:backup:verify {backup? : Nombre de la copia (por defecto, la más reciente)}';

    protected $description = 'Restaura una copia de seguridad en una base de datos temporal y comprueba que está completa';

    public function handle(BackupManager $backups): int
    {
        try {
            $report = $backups->verify($this->argument('backup'));
        } catch (Throwable $exception) {
            Log::error('La prueba de restauración ha fallado', ['error' => $exception->getMessage()]);
            $this->components->error('La prueba de restauración ha fallado: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->table(['Tabla', 'En la copia', 'Restauradas', ''], array_map(fn (array $row) => [
            $row['table'],
            $row['expected'],
            $row['restored'] ?? 'falta',
            $row['ok'] ? 'OK' : 'ERROR',
        ], $report['tables']));

        $this->components->twoColumnDetail('Huellas de los archivos', $report['checksums'] ? 'OK' : 'ERROR');
        $this->components->twoColumnDetail(
            'Archivos subidos',
            "{$report['media']['found']} de {$report['media']['expected']} ".($report['media']['ok'] ? 'OK' : 'ERROR'),
        );

        Log::log($report['ok'] ? 'info' : 'error', 'Prueba de restauración', ['name' => $report['name'], 'ok' => $report['ok']]);

        if (! $report['ok']) {
            $this->components->error("La copia {$report['name']} no se ha podido restaurar completa.");

            return self::FAILURE;
        }

        $this->components->info("La copia {$report['name']} se restaura correctamente.");

        return self::SUCCESS;
    }
}
