<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Rediseño «sencillo»: solo añade columnas; no borra ni transforma datos.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Clasificación opcional del gasto: need | treat | habitual | other.
            $table->string('spending_type', 12)->nullable()->after('nature');
        });

        Schema::table('debts', function (Blueprint $table) {
            // Lo que ya se había pagado antes de apuntar la deuda en la app.
            // No es un movimiento: no cambia el dinero disponible de hoy.
            $table->unsignedBigInteger('paid_before')->default(0)->after('principal');
            // «¿A quién se lo debes?» pasa a ser opcional («Portátil»).
            $table->string('creditor', 100)->nullable()->change();
        });

        Schema::table('users', function (Blueprint $table) {
            // Primera configuración terminada u omitida.
            $table->timestamp('setup_completed_at')->nullable()->after('onboarded_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('setup_completed_at'));
        Schema::table('debts', fn (Blueprint $table) => $table->dropColumn('paid_before'));
        Schema::table('transactions', fn (Blueprint $table) => $table->dropColumn('spending_type'));
    }
};
