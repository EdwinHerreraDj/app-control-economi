<?php

namespace App\Backup;

use Closure;

/**
 * Programas y argumentos de copia y restauración según el motor real del
 * servidor (MySQL o MariaDB).
 *
 * Laravel usa el driver «mysql» también para MariaDB, así que el motor se
 * deduce de la versión que informa el servidor. Las opciones exclusivas de
 * MySQL (como --set-gtid-purged) no se envían nunca a MariaDB, cuyo
 * mariadb-dump las rechaza.
 *
 * No ejecuta nada: solo construye las órdenes, para poder probarlas sin
 * herramientas externas.
 */
final class DatabaseTools
{
    public const MYSQL = 'mysql';

    public const MARIADB = 'mariadb';

    /** Programas candidatos, en orden de preferencia. */
    private const BINARIES = [
        'dump' => [self::MYSQL => ['mysqldump'], self::MARIADB => ['mariadb-dump', 'mysqldump']],
        'client' => [self::MYSQL => ['mysql'], self::MARIADB => ['mariadb', 'mysql']],
    ];

    /**
     * @param  Closure(string): ?string  $finder  Devuelve la ruta de un programa o null si no está instalado.
     */
    public function __construct(private readonly Closure $finder) {}

    /**
     * @return self::MYSQL|self::MARIADB
     */
    public static function engine(string $driver, string $serverVersion): string
    {
        // MariaDB se anuncia en la versión: «11.8.9-MariaDB-ubu2404» o, en
        // versiones antiguas, «5.5.5-10.6.18-MariaDB».
        return $driver === 'mariadb' || stripos($serverVersion, 'mariadb') !== false
            ? self::MARIADB
            : self::MYSQL;
    }

    /**
     * Programa de volcado: el configurado (BACKUP_MYSQLDUMP) o, si no hay,
     * el propio del motor que esté instalado.
     */
    public function dumpBinary(string $engine, ?string $configured = null): string
    {
        return $this->binary('dump', $engine, $configured);
    }

    /**
     * Cliente para restaurar: el configurado (BACKUP_MYSQL) o el del motor.
     */
    public function clientBinary(string $engine, ?string $configured = null): string
    {
        return $this->binary('client', $engine, $configured);
    }

    /**
     * Orden completa del volcado. --defaults-extra-file debe ir la primera.
     *
     * @return list<string>
     */
    public function dumpCommand(string $engine, string $binary, string $defaultsFile, string $database, string $resultFile): array
    {
        return [
            $binary,
            "--defaults-extra-file={$defaultsFile}",
            '--single-transaction',
            '--quick',
            '--routines',
            '--triggers',
            '--no-tablespaces',
            '--hex-blob',
            '--default-character-set=utf8mb4',
            // Exclusiva de MySQL: evita que el volcado reescriba el GTID del
            // servidor al restaurar. MariaDB no la conoce.
            ...($engine === self::MYSQL ? ['--set-gtid-purged=OFF'] : []),
            "--result-file={$resultFile}",
            $database,
        ];
    }

    /**
     * Orden para cargar un volcado (por la entrada estándar) en una base de datos.
     *
     * @return list<string>
     */
    public function restoreCommand(string $binary, string $defaultsFile, string $database): array
    {
        return [
            $binary,
            "--defaults-extra-file={$defaultsFile}",
            '--default-character-set=utf8mb4',
            $database,
        ];
    }

    private function binary(string $kind, string $engine, ?string $configured): string
    {
        if ($configured !== null && trim($configured) !== '') {
            return trim($configured);
        }

        $candidates = self::BINARIES[$kind][$engine] ?? self::BINARIES[$kind][self::MYSQL];

        foreach ($candidates as $candidate) {
            if (($path = ($this->finder)($candidate)) !== null) {
                return $path;
            }
        }

        // Sin encontrarlo, se usa el nombre preferido: el error del proceso
        // indicará claramente qué programa falta.
        return $candidates[0];
    }
}
