<?php

use App\Backup\DatabaseTools;

/**
 * Herramientas «instaladas» simuladas: no se ejecuta ningún programa.
 *
 * @param  list<string>  $installed
 */
function toolsWith(array $installed): DatabaseTools
{
    return new DatabaseTools(fn (string $name): ?string => in_array($name, $installed, true) ? "/usr/bin/{$name}" : null);
}

dataset('versions', [
    'MySQL 8.4' => ['mysql', '8.4.3', DatabaseTools::MYSQL],
    'MySQL 9' => ['mysql', '9.1.0-commercial', DatabaseTools::MYSQL],
    'MariaDB 11.8 con driver mysql' => ['mysql', '11.8.9-MariaDB-ubu2404', DatabaseTools::MARIADB],
    'MariaDB antigua (prefijo 5.5.5)' => ['mysql', '5.5.5-10.6.18-MariaDB-log', DatabaseTools::MARIADB],
    'driver mariadb' => ['mariadb', '10.11.6', DatabaseTools::MARIADB],
]);

test('the engine comes from the server version, not only from the driver', function (string $driver, string $version, string $expected) {
    expect(DatabaseTools::engine($driver, $version))->toBe($expected);
})->with('versions');

test('MariaDB dumps never receive MySQL-only options', function () {
    $command = toolsWith([])->dumpCommand(DatabaseTools::MARIADB, 'mariadb-dump', '/tmp/cred', 'economia', '/backups/db.sql');

    expect($command)
        ->not->toContain('--set-gtid-purged=OFF')
        ->and(implode(' ', $command))->not->toContain('gtid')
        ->and($command[0])->toBe('mariadb-dump')
        ->and($command[1])->toBe('--defaults-extra-file=/tmp/cred')
        ->and(array_slice($command, -2))->toBe(['--result-file=/backups/db.sql', 'economia']);
});

test('MySQL dumps keep the GTID option and the shared options', function () {
    $command = toolsWith([])->dumpCommand(DatabaseTools::MYSQL, 'mysqldump', '/tmp/cred', 'economia', '/backups/db.sql');

    expect($command)
        ->toContain('--set-gtid-purged=OFF')
        ->toContain('--single-transaction')
        ->toContain('--routines')
        ->toContain('--triggers')
        ->toContain('--no-tablespaces')
        ->toContain('--default-character-set=utf8mb4')
        ->and($command[1])->toBe('--defaults-extra-file=/tmp/cred')
        ->and(array_slice($command, -2))->toBe(['--result-file=/backups/db.sql', 'economia']);
});

test('both engines share every option except the GTID one', function () {
    $tools = toolsWith([]);
    $mysql = $tools->dumpCommand(DatabaseTools::MYSQL, 'x', 'c', 'db', 'f');
    $maria = $tools->dumpCommand(DatabaseTools::MARIADB, 'x', 'c', 'db', 'f');

    expect(array_values(array_diff($mysql, $maria)))->toBe(['--set-gtid-purged=OFF'])
        ->and(array_diff($maria, $mysql))->toBe([]);
});

test('MariaDB prefers its own programs and falls back to the mysql names', function () {
    expect(toolsWith(['mariadb-dump', 'mariadb', 'mysqldump', 'mysql'])->dumpBinary(DatabaseTools::MARIADB))->toBe('/usr/bin/mariadb-dump')
        ->and(toolsWith(['mariadb-dump', 'mariadb'])->clientBinary(DatabaseTools::MARIADB))->toBe('/usr/bin/mariadb')
        // Instalaciones antiguas de MariaDB solo traen los nombres clásicos.
        ->and(toolsWith(['mysqldump', 'mysql'])->dumpBinary(DatabaseTools::MARIADB))->toBe('/usr/bin/mysqldump')
        ->and(toolsWith(['mysqldump', 'mysql'])->clientBinary(DatabaseTools::MARIADB))->toBe('/usr/bin/mysql');
});

test('MySQL uses mysqldump and mysql', function () {
    $tools = toolsWith(['mysqldump', 'mysql', 'mariadb-dump', 'mariadb']);

    expect($tools->dumpBinary(DatabaseTools::MYSQL))->toBe('/usr/bin/mysqldump')
        ->and($tools->clientBinary(DatabaseTools::MYSQL))->toBe('/usr/bin/mysql');
});

test('a configured path always wins over detection', function () {
    $tools = toolsWith(['mariadb-dump']);

    expect($tools->dumpBinary(DatabaseTools::MARIADB, '/opt/db/bin/mysqldump'))->toBe('/opt/db/bin/mysqldump')
        ->and($tools->clientBinary(DatabaseTools::MYSQL, ' C:\\MySQL\\bin\\mysql.exe '))->toBe('C:\\MySQL\\bin\\mysql.exe')
        // Vacío equivale a «automático».
        ->and($tools->dumpBinary(DatabaseTools::MARIADB, ''))->toBe('/usr/bin/mariadb-dump');
});

test('without any program installed the preferred name is used so the error is clear', function () {
    expect(toolsWith([])->dumpBinary(DatabaseTools::MARIADB))->toBe('mariadb-dump')
        ->and(toolsWith([])->clientBinary(DatabaseTools::MYSQL))->toBe('mysql');
});

test('restoring uses the given client with the credentials file first', function () {
    expect(toolsWith([])->restoreCommand('mariadb', '/tmp/cred', 'economia_restore_check'))
        ->toBe(['mariadb', '--defaults-extra-file=/tmp/cred', '--default-character-set=utf8mb4', 'economia_restore_check']);
});
