<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Las invitaciones tienen su propia tabla de enlaces: compartirla con la
     * recuperación de contraseña permitía que una petición de recuperación
     * anulase la invitación pendiente de esa dirección.
     */
    public function up(): void
    {
        Schema::create('invitation_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Se trasladan las invitaciones vigentes (cuentas aún pendientes).
        $pending = DB::table('users')->where('status', 'pending')->pluck('email');

        DB::table('password_reset_tokens')->whereIn('email', $pending)->orderBy('email')->get()
            ->each(fn (object $row) => DB::table('invitation_tokens')->insert((array) $row));

        DB::table('password_reset_tokens')->whereIn('email', $pending)->delete();
    }

    public function down(): void
    {
        Schema::dropIfExists('invitation_tokens');
    }
};
