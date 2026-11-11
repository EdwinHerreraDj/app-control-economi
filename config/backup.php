<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Copias de seguridad
    |--------------------------------------------------------------------------
    |
    | Cada copia es una carpeta con la base de datos (database.sql.gz), los
    | archivos subidos (media.zip) y un manifiesto con recuentos y huellas.
    | Guárdalas también fuera del servidor y cifradas: contienen datos
    | financieros personales.
    |
    */

    'path' => env('BACKUP_PATH', storage_path('app/backups')),

    // Días que se conservan; siempre se mantienen al menos las 3 más recientes.
    'keep_days' => (int) env('BACKUP_KEEP_DAYS', 14),

    // Programas de volcado y restauración. Vacíos = automático según el motor
    // del servidor: mysqldump/mysql con MySQL, mariadb-dump/mariadb con MariaDB.
    // Indica la ruta completa solo si no están en el PATH.
    'mysqldump' => env('BACKUP_MYSQLDUMP'),
    'mysql' => env('BACKUP_MYSQL'),

    // Base de datos temporal para la prueba de restauración. El usuario de la
    // base de datos necesita permiso para crearla y borrarla.
    'verify_database' => env('BACKUP_VERIFY_DATABASE'),

];
