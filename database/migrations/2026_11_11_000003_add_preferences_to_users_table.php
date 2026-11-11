<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Sin valor por defecto: la moneda se pide en la primera
            // configuración, sin deducirla del idioma o la ubicación.
            $table->char('currency', 3)->nullable()->after('suspended_at');
            $table->string('number_locale', 10)->default('es-ES')->after('currency');
            $table->string('timezone', 64)->default('UTC')->after('number_locale');
            $table->string('locale', 5)->default('es')->after('timezone');
            $table->timestamp('onboarded_at')->nullable()->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['currency', 'number_locale', 'timezone', 'locale', 'onboarded_at']);
        });
    }
};
