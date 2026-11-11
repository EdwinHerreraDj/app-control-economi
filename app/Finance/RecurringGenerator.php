<?php

namespace App\Finance;

use App\Enums\TransactionStatus;
use App\Models\RecurringRule;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Genera los movimientos previstos de una regla recurrente dentro del
 * horizonte configurado.
 *
 * Es idempotente: la base de datos solo admite una previsión por regla y
 * fecha, así que repetir el proceso (o ejecutarlo en paralelo) no duplica.
 * Una previsión generada nunca se da por cobrada o pagada.
 */
class RecurringGenerator
{
    /**
     * @return int Número de previsiones nuevas.
     */
    public function generate(RecurringRule $rule, ?CarbonImmutable $today = null): int
    {
        if ($rule->isPaused() || $rule->account->isArchived()) {
            return 0;
        }

        $today ??= $rule->user->today();
        $horizon = $today->addDays((int) config('finance.recurring_horizon_days', 62));
        $from = $rule->generate_from->max($rule->starts_on);
        $until = $rule->ends_on !== null ? $rule->ends_on->min($horizon) : $horizon;

        $existing = $rule->transactions()
            ->whereBetween('occurrence_on', [$from->toDateString(), $until->toDateString()])
            ->pluck('occurrence_on')
            ->map(fn ($date) => CarbonImmutable::parse($date)->toDateString())
            ->all();

        $created = 0;

        for ($n = 0; $n < 5000; $n++) {
            $date = $rule->frequency->occurrence($rule->starts_on, $n);

            if ($date->greaterThan($until)) {
                break;
            }

            if ($date->lessThan($from) || in_array($date->toDateString(), $existing, true)) {
                continue;
            }

            try {
                $this->createOccurrence($rule, $date);
                $created++;
            } catch (UniqueConstraintViolationException) {
                // Otro proceso la generó a la vez: no hay nada que hacer.
            }
        }

        return $created;
    }

    /**
     * Borra las previsiones futuras aún pendientes (no confirmadas ni
     * anuladas) para regenerarlas con los datos nuevos de la regla.
     * Los movimientos ya confirmados nunca se tocan.
     */
    public function discardFutureForecasts(RecurringRule $rule, CarbonImmutable $today): void
    {
        $rule->transactions()
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->where('occurrence_on', '>=', $today->toDateString())
            ->delete();
    }

    private function createOccurrence(RecurringRule $rule, CarbonImmutable $date): void
    {
        $transaction = new Transaction([
            'kind' => $rule->kind,
            'status' => TransactionStatus::Planned,
            'account_id' => $rule->account_id,
            'category_id' => $rule->category_id,
            'recurring_rule_id' => $rule->id,
            'occurrence_on' => $date->toDateString(),
            'occurred_on' => $date->toDateString(),
            'amount' => $rule->amount,
            'currency' => $rule->currency,
            'concept' => $rule->concept,
            'nature' => $rule->nature,
        ]);
        $transaction->user_id = $rule->user_id;
        $transaction->save();
    }
}
