<?php

use Illuminate\Support\Facades\Schedule;

// Previsiones de ingresos y gastos recurrentes. Idempotente: si se ejecuta
// más de una vez (o tras una caída) no duplica movimientos.
Schedule::command('app:generate-recurring')
    ->dailyAt('01:30')
    ->withoutOverlapping()
    ->onOneServer();
