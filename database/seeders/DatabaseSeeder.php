<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Datos base de la aplicación. No crea usuarios ni credenciales: el primer
 * superusuario se crea con `php artisan app:create-superuser`.
 *
 * Es idempotente: `php artisan db:seed` puede repetirse en cada despliegue.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(MascotSeeder::class);
    }
}
