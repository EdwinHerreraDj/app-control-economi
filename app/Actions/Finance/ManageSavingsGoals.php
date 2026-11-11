<?php

namespace App\Actions\Finance;

use App\Models\SavingsContribution;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Objetivos de ahorro y sus aportaciones.
 *
 * Una aportación es una reserva: indica cuánto de tu dinero destinas al
 * objetivo, pero no mueve dinero entre cuentas. Para apartarlo de verdad,
 * se registra además una transferencia.
 */
class ManageSavingsGoals
{
    /**
     * @param  array{name: string, target_amount: int, target_date: string|null, icon: string, color: string}  $data
     */
    public function create(User $user, array $data): SavingsGoal
    {
        $goal = new SavingsGoal([...$data, 'currency' => $user->currency]);
        $goal->user()->associate($user);
        $goal->save();

        return $goal;
    }

    /**
     * @param  array{name: string, target_amount: int, target_date: string|null, icon: string, color: string}  $data
     */
    public function update(SavingsGoal $goal, array $data): void
    {
        DB::transaction(function () use ($goal, $data) {
            $goal->update($data);
            $this->refreshAchievement($goal);
        });
    }

    /**
     * @param  int  $amount  Positivo para reservar, negativo para liberar.
     */
    public function contribute(SavingsGoal $goal, int $amount, string $date, ?string $note): SavingsContribution
    {
        if ($amount === 0) {
            throw ValidationException::withMessages(['amount' => 'El importe debe ser distinto de cero.']);
        }

        return DB::transaction(function () use ($goal, $amount, $date, $note) {
            /** @var SavingsGoal $locked */
            $locked = SavingsGoal::query()->whereKey($goal->id)->lockForUpdate()->firstOrFail();
            $saved = $locked->savedAmount();

            if ($amount < 0 && $saved + $amount < 0) {
                throw ValidationException::withMessages([
                    'amount' => 'No puedes retirar más de lo reservado ('.Money::toDecimal($saved, $locked->currency)." {$locked->currency}).",
                ]);
            }

            $contribution = new SavingsContribution([
                'savings_goal_id' => $locked->id,
                'amount' => $amount,
                'currency' => $locked->currency,
                'contributed_on' => $date,
                'note' => $note,
            ]);
            $contribution->user_id = $locked->user_id;
            $contribution->save();

            $this->refreshAchievement($locked);

            return $contribution;
        });
    }

    public function archive(SavingsGoal $goal): void
    {
        $goal->update(['archived_at' => now()]);
    }

    public function restore(SavingsGoal $goal): void
    {
        $goal->update(['archived_at' => null]);
    }

    /** Marca el objetivo como alcanzado (hito) mientras lo reservado llegue a la meta. */
    private function refreshAchievement(SavingsGoal $goal): void
    {
        $reached = $goal->savedAmount() >= $goal->target_amount;

        $goal->update([
            'achieved_at' => $reached ? ($goal->achieved_at ?? now()) : null,
        ]);
    }
}
