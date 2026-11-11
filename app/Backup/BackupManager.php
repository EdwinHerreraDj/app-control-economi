<?php

namespace App\Backup;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use PDO;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;
use Symfony\Component\Process\Process;
use ZipArchive;

/**
 * Copias de seguridad de la base de datos (MySQL 8+ o MariaDB 10.6+) y de los
 * archivos subidos, y su prueba de restauración en una base de datos temporal.
 * Los programas y opciones de cada motor los decide DatabaseTools.
 *
 * Las credenciales nunca van en la línea de órdenes (serían visibles en la
 * lista de procesos): se pasan en un archivo temporal legible solo por el
 * usuario del sistema, que se borra al terminar.
 */
class BackupManager
{
    /** Tablas que cambian constantemente y no se comparan al verificar. */
    private const VOLATILE = ['sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs'];

    private const NAME = '/^\d{8}-\d{6}$/';

    public function __construct(private readonly DatabaseTools $tools) {}

    /**
     * @return array{name: string, path: string, created_at: string, tables: array<string, int>, consistent: bool, media_files: int, files: array<string, array{sha256: string, bytes: int}>}
     */
    public function create(): array
    {
        $connection = $this->connection();
        $name = now()->format('Ymd-His');
        $directory = $this->path($name);
        File::ensureDirectoryExists($directory, 0700);

        $before = $this->rowCounts($connection['database']);
        $sql = $directory.DIRECTORY_SEPARATOR.'database.sql';

        $engine = $this->engine($connection);
        $binary = $this->tools->dumpBinary($engine, $this->configured('backup.mysqldump'));

        $this->withCredentials($connection, fn (string $defaults) => $this->run(
            $this->tools->dumpCommand($engine, $binary, $defaults, $connection['database'], $sql),
        ));

        $this->gzip($sql, $sql.'.gz');
        File::delete($sql);
        $after = $this->rowCounts($connection['database']);

        $mediaFiles = $this->zipMedia($directory.DIRECTORY_SEPARATOR.'media.zip');

        $files = [];
        foreach (['database.sql.gz', 'media.zip'] as $file) {
            $full = $directory.DIRECTORY_SEPARATOR.$file;
            if (is_file($full)) {
                $files[$file] = ['sha256' => (string) hash_file('sha256', $full), 'bytes' => (int) filesize($full)];
            }
        }

        $manifest = [
            'name' => $name,
            'created_at' => now()->toIso8601String(),
            'tables' => $before,
            // Si algo cambió durante la copia, los recuentos son orientativos.
            'consistent' => $before === $after,
            'media_files' => $mediaFiles,
            'files' => $files,
        ];

        File::put($directory.DIRECTORY_SEPARATOR.'manifest.json', (string) json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return [...$manifest, 'path' => $directory];
    }

    /**
     * Borra las copias antiguas. Siempre conserva las 3 más recientes.
     *
     * @return list<string> Copias borradas.
     */
    public function prune(): array
    {
        $limit = now()->subDays((int) config('backup.keep_days'))->format('Ymd-His');
        $deleted = [];

        foreach (array_slice($this->list(), 3) as $name) {
            if ($name < $limit) {
                File::deleteDirectory($this->path($name));
                $deleted[] = $name;
            }
        }

        return $deleted;
    }

    /**
     * Copias disponibles, de la más reciente a la más antigua.
     *
     * @return list<string>
     */
    public function list(): array
    {
        $root = (string) config('backup.path');

        if (! is_dir($root)) {
            return [];
        }

        $names = array_values(array_filter(
            array_map('basename', File::directories($root)),
            fn (string $name) => preg_match(self::NAME, $name) === 1
                && is_file($this->path($name).DIRECTORY_SEPARATOR.'manifest.json'),
        ));
        rsort($names);

        return $names;
    }

    /**
     * Restaura la copia en una base de datos temporal y la compara con su
     * manifiesto. La base de datos temporal se borra siempre al terminar.
     *
     * @return array{name: string, ok: bool, checksums: bool, tables: list<array{table: string, expected: int, restored: int|null, ok: bool}>, media: array{expected: int, found: int, ok: bool}}
     */
    public function verify(?string $name = null): array
    {
        $name ??= $this->list()[0] ?? throw new RuntimeException('No hay copias de seguridad.');

        if (preg_match(self::NAME, $name) !== 1 || ! is_file($this->path($name).DIRECTORY_SEPARATOR.'manifest.json')) {
            throw new RuntimeException("No existe la copia «{$name}».");
        }

        $directory = $this->path($name);
        /** @var array{tables: array<string, int>, consistent: bool, media_files: int, files: array<string, array{sha256: string, bytes: int}>} $manifest */
        $manifest = json_decode((string) File::get($directory.DIRECTORY_SEPARATOR.'manifest.json'), true);

        $checksums = true;
        foreach ($manifest['files'] as $file => $meta) {
            $full = $directory.DIRECTORY_SEPARATOR.$file;
            $checksums = $checksums && is_file($full) && hash_file('sha256', $full) === $meta['sha256'];
        }

        if (! isset($manifest['files']['database.sql.gz'])) {
            throw new RuntimeException('La copia no contiene la base de datos.');
        }

        $connection = $this->connection();
        $temporary = (string) (config('backup.verify_database') ?: $connection['database'].'_restore_check');

        if (preg_match('/^[A-Za-z0-9_]+$/', $temporary) !== 1 || $temporary === $connection['database']) {
            throw new RuntimeException('El nombre de la base de datos temporal no es válido.');
        }

        $tables = [];

        try {
            DB::statement("DROP DATABASE IF EXISTS `{$temporary}`");
            DB::statement("CREATE DATABASE `{$temporary}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

            $dump = fopen('compress.zlib://'.$directory.DIRECTORY_SEPARATOR.'database.sql.gz', 'rb');

            if ($dump === false) {
                throw new RuntimeException('No se pudo leer la copia de la base de datos.');
            }

            try {
                // Cliente del mismo motor: los volcados de MariaDB 11 empiezan
                // con una línea que el cliente de MySQL no entiende.
                $client = $this->tools->clientBinary($this->engine($connection), $this->configured('backup.mysql'));

                $this->withCredentials($connection, fn (string $defaults) => $this->run(
                    $this->tools->restoreCommand($client, $defaults, $temporary),
                    $dump,
                ));
            } finally {
                fclose($dump);
            }

            config(['database.connections.backup_verify' => [...$connection, 'database' => $temporary]]);
            $restored = DB::connection('backup_verify');
            $existing = Schema::connection('backup_verify')->getTableListing($temporary, false);

            foreach ($manifest['tables'] as $table => $expected) {
                $count = in_array($table, $existing, true) ? (int) $restored->table($table)->count() : null;
                // Con recuentos orientativos solo se exige que la tabla exista.
                $ok = $count !== null && ($manifest['consistent'] ? $count === $expected : true);
                $tables[] = ['table' => $table, 'expected' => $expected, 'restored' => $count, 'ok' => $ok];
            }
        } finally {
            DB::purge('backup_verify');
            DB::statement("DROP DATABASE IF EXISTS `{$temporary}`");
        }

        $media = ['expected' => $manifest['media_files'], 'found' => 0, 'ok' => $manifest['media_files'] === 0];
        $zipPath = $directory.DIRECTORY_SEPARATOR.'media.zip';

        if (is_file($zipPath)) {
            $zip = new ZipArchive;
            if ($zip->open($zipPath, ZipArchive::CHECKCONS) === true) {
                $media['found'] = $zip->numFiles;
                $media['ok'] = $zip->numFiles === $manifest['media_files'];
                $zip->close();
            } else {
                $media['ok'] = false;
            }
        }

        $ok = $checksums && $media['ok'] && collect($tables)->every(fn (array $row) => $row['ok']);

        return ['name' => $name, 'ok' => $ok, 'checksums' => $checksums, 'tables' => $tables, 'media' => $media];
    }

    public function path(string $name): string
    {
        return rtrim((string) config('backup.path'), '/\\').DIRECTORY_SEPARATOR.$name;
    }

    /**
     * @return array{driver: string, host: string, port: int|string, database: string, username: string, password: string, unix_socket?: string}
     */
    private function connection(): array
    {
        /** @var array{driver: string, host: string, port: int|string, database: string, username: string, password: string, unix_socket?: string} $connection */
        $connection = config('database.connections.'.config('database.default'));

        if (! in_array($connection['driver'], ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Las copias de seguridad solo admiten MySQL o MariaDB.');
        }

        return $connection;
    }

    /**
     * Motor real del servidor: Laravel usa el driver «mysql» también con MariaDB.
     *
     * @param  array{driver: string}  $connection
     */
    private function engine(array $connection): string
    {
        $version = (string) DB::connection()->getPdo()->getAttribute(PDO::ATTR_SERVER_VERSION);

        return DatabaseTools::engine($connection['driver'], $version);
    }

    private function configured(string $key): ?string
    {
        $value = config($key);

        return is_string($value) && trim($value) !== '' ? $value : null;
    }

    /**
     * @return array<string, int>
     */
    private function rowCounts(string $database): array
    {
        $counts = [];

        // Solo las tablas de la base de datos de la app (el servidor puede tener otras).
        foreach (Schema::getTableListing($database, false) as $name) {
            if (! in_array($name, self::VOLATILE, true)) {
                $counts[$name] = (int) DB::table($name)->count();
            }
        }

        ksort($counts);

        return $counts;
    }

    /**
     * @param  array{host: string, port: int|string, username: string, password: string, unix_socket?: string}  $connection
     * @param  callable(string): void  $callback
     */
    private function withCredentials(array $connection, callable $callback): void
    {
        $quote = fn (string $value) => '"'.addcslashes($value, '\\"').'"';
        $lines = [
            '[client]',
            'user='.$quote((string) $connection['username']),
            'password='.$quote((string) $connection['password']),
            'host='.$quote((string) $connection['host']),
            'port='.(int) $connection['port'],
        ];

        if (! empty($connection['unix_socket'])) {
            $lines[] = 'socket='.$quote($connection['unix_socket']);
        }

        $file = (string) tempnam(sys_get_temp_dir(), 'bkp');
        chmod($file, 0600);
        File::put($file, implode(PHP_EOL, $lines).PHP_EOL);

        try {
            $callback($file);
        } finally {
            File::delete($file);
        }
    }

    /**
     * @param  list<string>  $command
     * @param  resource|null  $input
     */
    private function run(array $command, $input = null): void
    {
        $process = new Process($command, null, null, $input, 3600);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException(trim($process->getErrorOutput()) ?: 'El proceso de copia ha fallado.');
        }
    }

    private function gzip(string $source, string $target): void
    {
        $in = fopen($source, 'rb');
        $out = gzopen($target, 'wb6');

        if ($in === false || $out === false) {
            throw new RuntimeException('No se pudo comprimir la copia de la base de datos.');
        }

        while (! feof($in)) {
            gzwrite($out, (string) fread($in, 1 << 20));
        }

        fclose($in);
        gzclose($out);
    }

    /**
     * Archivos subidos (logotipos, iconos, mascotas). Devuelve cuántos hay.
     */
    private function zipMedia(string $target): int
    {
        $root = storage_path('app/public');

        if (! is_dir($root)) {
            return 0;
        }

        $zip = new ZipArchive;
        if ($zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('No se pudo crear el archivo de los recursos subidos.');
        }

        $count = 0;
        /** @var SplFileInfo $file */
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS)) as $file) {
            if ($file->isFile() && $file->getFilename() !== '.gitignore') {
                $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
                $zip->addFile($file->getPathname(), $relative);
                $count++;
            }
        }

        $zip->close();

        return $count;
    }
}
