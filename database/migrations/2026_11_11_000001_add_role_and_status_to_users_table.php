<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Los usuarios invitados no tienen contraseña hasta aceptar la invitación.
            $table->string('password')->nullable()->change();

            $table->string('role', 20)->default('user')->after('password')->index();
            $table->string('status', 20)->default('pending')->after('role')->index();
            $table->timestamp('invited_at')->nullable()->after('status');
            $table->timestamp('activated_at')->nullable()->after('invited_at');
            $table->timestamp('suspended_at')->nullable()->after('activated_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'status', 'invited_at', 'activated_at', 'suspended_at']);
            $table->string('password')->nullable(false)->change();
        });
    }
};
