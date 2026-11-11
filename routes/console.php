<?php

use Illuminate\Support\Facades\Schedule;

// Previsiones de ingresos y gastos recurrentes. Idempotente: si se ejecuta
// más de una vez (o tras una caída) no duplica movimientos.
Schedule::command('app:generate-recurring')
    ->dailyAt('01:30')
    ->withoutOverlapping()
    ->onOneServer();

// Copia de seguridad diaria y prueba de restauración semanal.
Schedule::command('app:backup')
    ->dailyAt('03:00')
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('app:backup:verify')
    ->weeklyOn(0, '04:30')
    ->withoutOverlapping()
    ->onOneServer();

// Coherencia de los datos financieros (solo lectura).
Schedule::command('app:check-integrity')
    ->weeklyOn(0, '05:00')
    ->onOneServer();
