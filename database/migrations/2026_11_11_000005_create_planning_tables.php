<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Deudas, recurrencias, presupuestos y objetivos de ahorro.
 * Importes en unidades menores (enteros), como el resto de tablas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('creditor', 100);
            $table->string('concept', 255);
            $table->char('currency', 3);
            $table->unsignedBigInteger('principal'); // capital inicial
            $table->date('started_on');
            $table->unsignedBigInteger('installment')->nullable(); // cuota orientativa
            $table->string('frequency', 20)->nullable();
            $table->date('next_due_on')->nullable();
            // Solo informativo: no se calculan intereses que el usuario no registre.
            $table->decimal('interest_rate', 7, 4)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'settled_at']);
        });

        Schema::create('debt_payments', function (Blueprint $table) {
            $table->id();
            $table->uuid()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('debt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->restrictOnDelete();
            $table->date('paid_on');
            $table->unsignedBigInteger('principal_amount')->default(0);
            $table->unsignedBigInteger('interest_amount')->default(0);
            $table->unsignedBigInteger('fees_amount')->default(0);
            $table->char('currency', 3);
            $table->text('notes')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['debt_id', 'voided_at']);
        });

        Schema::create('recurring_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10); // income | expense
            $table->foreignId('account_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('concept', 255);
            $table->string('nature', 10)->nullable();
            $table->string('frequency', 20);
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            // No se generan previsiones anteriores a esta fecha (alta o última edición).
            $table->date('generate_from');
            $table->timestamp('paused_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'paused_at']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('debt_id')->nullable()->after('transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('debt_payment_id')->nullable()->after('debt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recurring_rule_id')->nullable()->after('debt_payment_id')->constrained()->nullOnDelete();
            $table->date('occurrence_on')->nullable()->after('recurring_rule_id');

            // Idempotencia: una sola previsión por regla y fecha.
            $table->unique(['recurring_rule_id', 'occurrence_on']);
        });

        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount'); // límite mensual
            $table->char('currency', 3);
            $table->timestamps();

            $table->unique(['user_id', 'category_id']);
        });

        Schema::create('savings_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->unsignedBigInteger('target_amount');
            $table->char('currency', 3);
            $table->date('target_date')->nullable();
            $table->string('icon', 40)->default('piggy-bank');
            $table->string('color', 20)->default('teal');
            $table->timestamp('achieved_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('savings_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('savings_goal_id')->constrained()->cascadeOnDelete();
            // Positivo: reservar para el objetivo. Negativo: liberar lo reservado.
            $table->bigInteger('amount');
            $table->char('currency', 3);
            $table->date('contributed_on');
            $table->string('note', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('savings_contributions');
        Schema::dropIfExists('savings_goals');
        Schema::dropIfExists('budgets');

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique(['recurring_rule_id', 'occurrence_on']);
            $table->dropConstrainedForeignId('recurring_rule_id');
            $table->dropConstrainedForeignId('debt_payment_id');
            $table->dropConstrainedForeignId('debt_id');
            $table->dropColumn('occurrence_on');
        });

        Schema::dropIfExists('recurring_rules');
        Schema::dropIfExists('debt_payments');
        Schema::dropIfExists('debts');
    }
};
