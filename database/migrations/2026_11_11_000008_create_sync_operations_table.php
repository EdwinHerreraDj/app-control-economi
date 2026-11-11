<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Operaciones registradas sin conexión y enviadas al sincronizar.
     * El identificador lo genera el dispositivo: reenviarlo no duplica nada.
     */
    public function up(): void
    {
        Schema::create('sync_operations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('uuid');
            $table->string('type', 40);
            // applied: aplicada; rejected: no válida; conflict: requiere decisión.
            $table->string('status', 12);
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->json('errors')->nullable();
            $table->unsignedInteger('attempts')->default(1);
            $table->timestamp('client_created_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'uuid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_operations');
    }
};
