<?php

namespace App\Enums;

enum TransactionKind: string
{
    case Income = 'income';
    case Expense = 'expense';
    /** Entrada de una transferencia entre cuentas propias (no es ingreso). */
    case TransferIn = 'transfer_in';
    /** Salida de una transferencia entre cuentas propias (no es gasto). */
    case TransferOut = 'transfer_out';
    /** Dinero recibido de un préstamo: aumenta saldo y deuda, no es ingreso. */
    case DebtIn = 'debt_in';
    /** Devolución de capital: reduce saldo y deuda, no es gasto. */
    case DebtOut = 'debt_out';

    /** Signo con el que el movimiento afecta al saldo de su cuenta. */
    public function sign(): int
    {
        return match ($this) {
            self::Income, self::TransferIn, self::DebtIn => 1,
            self::Expense, self::TransferOut, self::DebtOut => -1,
        };
    }

    /**
     * @return list<string> Valores de los tipos que suman al saldo.
     */
    public static function positiveValues(): array
    {
        return array_values(array_map(
            fn (self $kind) => $kind->value,
            array_filter(self::cases(), fn (self $kind) => $kind->sign() === 1),
        ));
    }

    public function isTransfer(): bool
    {
        return $this === self::TransferIn || $this === self::TransferOut;
    }

    public function isDebtPrincipal(): bool
    {
        return $this === self::DebtIn || $this === self::DebtOut;
    }

    public function categoryKind(): ?CategoryKind
    {
        return match ($this) {
            self::Income => CategoryKind::Income,
            self::Expense => CategoryKind::Expense,
            default => null,
        };
    }
}
