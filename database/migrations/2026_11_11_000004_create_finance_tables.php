<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tablas financieras básicas.
 *
 * Los importes se guardan como enteros en la unidad menor de la moneda
 * (céntimos), nunca con coma flotante. Cada registro conserva su moneda.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('type', 20);
            $table->char('currency', 3);
            // Puede ser negativo (por ejemplo, una cuenta en descubierto).
            $table->bigInteger('initial_balance')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'archived_at']);
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10); // income | expense
            $table->string('name', 60);
            $table->string('icon', 40);
            $table->string('color', 20);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'kind', 'name']);
        });

        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->uuid()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_account_id')->constrained('accounts')->restrictOnDelete();
            $table->foreignId('to_account_id')->constrained('accounts')->restrictOnDelete();
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('occurred_on');
            $table->string('status', 10); // planned | confirmed
            $table->string('concept', 255)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'occurred_on']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            // Identificador estable para la sincronización offline (fase 8).
            $table->uuid()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('transfer_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('kind', 20); // income | expense | transfer_in | transfer_out
            $table->string('status', 10); // planned | confirmed
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('occurred_on');
            $table->date('due_on')->nullable();
            $table->string('nature', 10)->nullable(); // fixed | variable (gastos)
            $table->string('concept', 255);
            $table->text('notes')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'occurred_on']);
            $table->index(['account_id', 'status', 'voided_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('transfers');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('accounts');
    }
};
