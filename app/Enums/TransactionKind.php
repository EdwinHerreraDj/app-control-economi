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

    /** Signo con el que el movimiento afecta al saldo de su cuenta. */
    public function sign(): int
    {
        return match ($this) {
            self::Income, self::TransferIn => 1,
            self::Expense, self::TransferOut => -1,
        };
    }

    public function isTransfer(): bool
    {
        return $this === self::TransferIn || $this === self::TransferOut;
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
