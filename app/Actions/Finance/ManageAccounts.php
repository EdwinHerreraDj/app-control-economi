<?php

namespace App\Actions\Finance;

use App\Enums\AccountType;
use App\Finance\AccountBalances;
use App\Models\Account;
use App\Models\User;
use App\Support\Money;
use Illuminate\Validation\ValidationException;

class ManageAccounts
{
    public function __construct(private readonly AccountBalances $balances) {}

    /**
     * La cuenta usa la moneda principal del usuario (una sola moneda
     * operativa por espacio personal en esta versión).
     */
    public function create(User $user, string $name, AccountType $type, int $initialBalance): Account
    {
        if ($user->currency === null) {
            throw ValidationException::withMessages([
                'name' => 'Elige tu moneda principal en Preferencias antes de crear cuentas.',
            ]);
        }

        $account = new Account([
            'name' => $name,
            'type' => $type,
            'initial_balance' => $initialBalance,
        ]);
        $account->currency = $user->currency;
        $account->user()->associate($user);
        $account->save();

        return $account;
    }

    public function update(Account $account, string $name, AccountType $type, int $initialBalance): void
    {
        $account->update([
            'name' => $name,
            'type' => $type,
            'initial_balance' => $initialBalance,
        ]);
    }

    /**
     * Archivar oculta la cuenta para movimientos nuevos sin perder su
     * historial. Para que el dinero no «desaparezca» de los totales, solo
     * se permite con saldo cero y sin movimientos previstos pendientes.
     */
    public function archive(Account $account): void
    {
        $balance = $this->balances->forAccount($account);

        if ($balance !== 0) {
            $formatted = Money::toDecimal($balance, $account->currency);

            throw ValidationException::withMessages([
                'account' => "La cuenta tiene un saldo de {$formatted} {$account->currency}. Transfiere o registra ese importe antes de archivarla.",
            ]);
        }

        $hasPlanned = $account->transactions()
            ->where('status', 'planned')
            ->whereNull('voided_at')
            ->exists();

        if ($hasPlanned) {
            throw ValidationException::withMessages([
                'account' => 'La cuenta tiene movimientos previstos pendientes. Confírmalos, muévelos a otra cuenta o anúlalos antes de archivarla.',
            ]);
        }

        $account->forceFill(['archived_at' => now()])->save();
    }

    public function restore(Account $account): void
    {
        $account->forceFill(['archived_at' => null])->save();
    }

    public function parseInitialBalance(string $value, User $user): int
    {
        return Money::toMinor($value, (string) $user->currency, allowNegative: true);
    }
}
