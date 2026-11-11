<?php

namespace App\Sync;

use App\Enums\TransactionKind;
use App\Finance\AccountBalances;
use App\Finance\UpcomingCommitments;
use App\Mascots\MascotCompanion;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;

/**
 * Copia de consulta que el dispositivo guarda para usar la app sin conexión.
 *
 * Contiene solo lo necesario para consultar saldos y movimientos recientes y
 * para registrar ingresos o gastos: los cálculos los hace aquí el servidor.
 */
class OfflineSnapshot
{
    public const RECENT_LIMIT = 60;

    public function __construct(
        private readonly AccountBalances $balances,
        private readonly UpcomingCommitments $upcoming,
        private readonly MascotCompanion $companion,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $currency = (string) $user->currency;
        $balances = $this->balances->forUser($user);

        $accounts = Account::query()->ownedBy($user)->orderBy('name')->get()
            ->map(fn (Account $account) => [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type->value,
                'currency' => $account->currency,
                'archived' => $account->isArchived(),
                'balance' => Money::toDecimal($balances[$account->id] ?? 0, $account->currency),
            ]);

        $total = collect($balances)
            ->only($accounts->where('archived', false)->pluck('id')->all())
            ->sum();

        $mascot = $user->mascot_visibility === 'hidden' ? null : $this->companion->mascotFor($user);

        return [
            'user' => ['id' => $user->id, 'name' => $user->name],
            'preferences' => $user->preferences(),
            'generated_at' => now()->toIso8601String(),
            'today' => $user->today()->toDateString(),
            'balance' => Money::toDecimal((int) $total, $currency),
            'accounts' => $accounts->values()->all(),
            'categories' => Category::query()->ownedBy($user)->whereNull('archived_at')->orderBy('name')
                ->get(['id', 'kind', 'name', 'icon', 'color'])
                ->map(fn (Category $category) => [
                    'id' => $category->id,
                    'kind' => $category->kind->value,
                    'name' => $category->name,
                    'icon' => $category->icon,
                    'color' => $category->color,
                ])->values()->all(),
            'recent' => $this->recent($user),
            'upcoming' => array_slice($this->upcoming->forUser($user, 14), 0, 8),
            'mascot' => $mascot === null ? null : [
                'name' => $mascot->name,
                'images' => $mascot->images(),
                'visibility' => $user->mascot_visibility,
                'motion' => $user->mascot_motion,
            ],
        ];
    }

    /**
     * Últimos movimientos ya ocurridos. Cada transferencia aparece una vez.
     *
     * @return list<array<string, mixed>>
     */
    private function recent(User $user): array
    {
        return array_values(Transaction::query()
            ->ownedBy($user)
            ->whereNull('voided_at')
            ->where('kind', '!=', TransactionKind::TransferIn->value)
            ->where('occurred_on', '<=', $user->today()->toDateString())
            ->with(['account:id,name', 'category:id,name,icon,color'])
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->limit(self::RECENT_LIMIT)
            ->get()
            ->map(fn (Transaction $transaction) => [
                'uuid' => $transaction->uuid,
                'kind' => $transaction->kind->value,
                'status' => $transaction->status->value,
                'amount' => Money::toDecimal($transaction->amount, $transaction->currency),
                'currency' => $transaction->currency,
                'occurred_on' => $transaction->occurred_on->toDateString(),
                'concept' => $transaction->concept,
                'account' => $transaction->account->name,
                'category' => $transaction->category ? [
                    'name' => $transaction->category->name,
                    'icon' => $transaction->category->icon,
                    'color' => $transaction->category->color,
                ] : null,
            ])
            ->all());
    }
}
