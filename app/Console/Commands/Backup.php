<?php

namespace App\Console\Commands;

use App\Backup\BackupManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Number;
use Throwable;

/**
 * Copia de seguridad de la base de datos y de los archivos subidos. Se
 * ejecuta a diario desde el scheduler y borra las copias caducadas.
 */
class Backup extends Command
{
    protected $signature = 'app:backup';

    protected $description = 'Crea una copia de seguridad de la base de datos y de los archivos subidos';

    public function handle(BackupManager $backups): int
    {
        try {
            $backup = $backups->create();
        } catch (Throwable $exception) {
            Log::error('La copia de seguridad ha fallado', ['error' => $exception->getMessage()]);
            $this->components->error('La copia de seguridad ha fallado: '.$exception->getMessage());

            return self::FAILURE;
        }

        $deleted = $backups->prune();

        $this->components->info("Copia creada: {$backup['path']}");
        foreach ($backup['files'] as $file => $meta) {
            $this->components->twoColumnDetail($file, Number::fileSize($meta['bytes']));
        }
        $this->components->twoColumnDetail('Tablas', (string) count($backup['tables']));
        $this->components->twoColumnDetail('Archivos subidos', (string) $backup['media_files']);

        if ($deleted !== []) {
            $this->components->twoColumnDetail('Copias antiguas borradas', implode(', ', $deleted));
        }

        Log::info('Copia de seguridad creada', ['name' => $backup['name'], 'deleted' => $deleted]);

        return self::SUCCESS;
    }
}
