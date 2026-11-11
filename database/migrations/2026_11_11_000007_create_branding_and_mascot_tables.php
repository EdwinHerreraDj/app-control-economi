<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identidad visual global y catálogo de mascotas.
 *
 * Los archivos subidos se guardan en el almacenamiento persistente de la
 * aplicación (disco «public»), no en Git; aquí solo se guardan referencias.
 * Cada archivo nuevo recibe un nombre único, lo que renueva las cachés.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        Schema::create('media_assets', function (Blueprint $table) {
            $table->id();
            $table->string('purpose', 40)->index(); // brand.logo, mascot, ...
            $table->string('disk', 20)->default('public');
            $table->string('path');
            $table->string('mime', 60);
            $table->unsignedInteger('size');
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->unsignedInteger('duration_ms')->nullable(); // animaciones
            $table->char('checksum', 64);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('mascots', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('name', 60);
            $table->text('description')->nullable();
            $table->string('status', 12)->default('draft'); // draft | published | archived
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('mascot_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mascot_id')->constrained()->cascadeOnDelete();
            $table->string('state', 20); // cover, idle, welcome, celebration, attention, support, unknown
            $table->foreignId('media_asset_id')->constrained('media_assets')->restrictOnDelete();
            $table->foreignId('animated_media_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->timestamps();

            $table->unique(['mascot_id', 'state']);
        });

        Schema::create('mascot_messages', function (Blueprint $table) {
            $table->id();
            // Nulo: mensaje común a todas las mascotas.
            $table->foreignId('mascot_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('state', 20)->index();
            $table->string('template', 280);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // La mascota (la predeterminada), su nombre y sus mensajes los decide
        // el superusuario. Cada persona solo ajusta lo relativo a accesibilidad:
        // mostrarla, minimizarla u ocultarla, y reducir sus animaciones.
        Schema::table('users', function (Blueprint $table) {
            $table->string('mascot_visibility', 12)->default('shown')->after('onboarded_at'); // shown | minimized | hidden
            $table->string('mascot_motion', 10)->default('full')->after('mascot_visibility'); // full | reduced | none
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mascot_visibility', 'mascot_motion']);
        });

        Schema::dropIfExists('mascot_messages');
        Schema::dropIfExists('mascot_assets');
        Schema::dropIfExists('mascots');
        Schema::dropIfExists('media_assets');
        Schema::dropIfExists('app_settings');
    }
};
