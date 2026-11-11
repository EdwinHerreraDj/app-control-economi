<?php

namespace App\Actions\Finance;

use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Finance\RecurringGenerator;
use App\Models\Account;
use App\Models\Category;
use App\Models\RecurringRule;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManageRecurringRules
{
    public function __construct(private readonly RecurringGenerator $generator) {}

    /**
     * generate_from permite saltarse fechas ya registradas: al marcar un
     * movimiento como «se repite», ese mismo movimiento es la primera vez.
     *
     * @param  array{kind: TransactionKind, account: Account, category: Category, amount: int, concept: string, nature: ExpenseNature|null, frequency: Frequency, starts_on: string, ends_on: string|null, generate_from?: string}  $data
     */
    public function create(User $user, array $data): RecurringRule
    {
        $this->guard($data);

        return DB::transaction(function () use ($user, $data) {
            $rule = new RecurringRule([
                ...$this->attributes($data),
                'currency' => $data['account']->currency,
                'generate_from' => max($user->today()->toDateString(), $data['generate_from'] ?? ''),
            ]);
            $rule->user()->associate($user);
            $rule->save();

            $this->generator->generate($rule);

            return $rule;
        });
    }

    /**
     * @param  array{account: Account, category: Category, amount: int, concept: string, nature: ExpenseNature|null, frequency: Frequency, starts_on: string, ends_on: string|null}  $data
     */
    public function update(RecurringRule $rule, array $data): void
    {
        $data['kind'] = $rule->kind;
        $this->guard($data, $rule);

        DB::transaction(function () use ($rule, $data) {
            $today = $rule->user->today();
            $this->generator->discardFutureForecasts($rule, $today);

            $rule->update([
                ...$this->attributes($data),
                'currency' => $data['account']->currency,
                'generate_from' => $today->toDateString(),
            ]);

            $this->generator->generate($rule->refresh());
        });
    }

    public function pause(RecurringRule $rule): void
    {
        DB::transaction(function () use ($rule) {
            $this->generator->discardFutureForecasts($rule, $rule->user->today());
            $rule->update(['paused_at' => now()]);
        });
    }

    public function resume(RecurringRule $rule): void
    {
        DB::transaction(function () use ($rule) {
            $rule->update([
                'paused_at' => null,
                'generate_from' => $rule->user->today()->toDateString(),
            ]);
            $this->generator->generate($rule->refresh());
        });
    }

    /**
     * Elimina la regla y sus previsiones pendientes. Los movimientos ya
     * confirmados se conservan (pierden solo el enlace a la regla).
     */
    public function delete(RecurringRule $rule): void
    {
        DB::transaction(function () use ($rule) {
            $this->generator->discardFutureForecasts($rule, $rule->user->today());
            $rule->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data): array
    {
        return [
            'kind' => $data['kind'],
            'account_id' => $data['account']->id,
            'category_id' => $data['category']->id,
            'amount' => $data['amount'],
            'concept' => $data['concept'],
            'nature' => $data['kind'] === TransactionKind::Expense ? $data['nature'] : null,
            'frequency' => $data['frequency'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function guard(array $data, ?RecurringRule $rule = null): void
    {
        /** @var Account $account */
        $account = $data['account'];
        /** @var Category $category */
        $category = $data['category'];
        /** @var TransactionKind $kind */
        $kind = $data['kind'];

        if ($account->isArchived() && $account->id !== $rule?->account_id) {
            throw ValidationException::withMessages(['account_id' => 'La cuenta está archivada.']);
        }

        if ($category->kind !== $kind->categoryKind()) {
            throw ValidationException::withMessages(['category_id' => 'La categoría no corresponde al tipo de movimiento.']);
        }

        if ($data['ends_on'] !== null && $data['ends_on'] < $data['starts_on']) {
            throw ValidationException::withMessages(['ends_on' => 'La fecha de fin debe ser posterior a la de inicio.']);
        }
    }
}
