<?php

namespace App\Actions\Finance;

use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Models\Category;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Deudas del usuario y sus pagos.
 *
 * Reglas (CONTEXT.md §6 y §7):
 * - Recibir el préstamo suma al saldo y a la deuda, pero no es un ingreso.
 * - Devolver capital resta del saldo y de la deuda, pero no es un gasto.
 * - Intereses y comisiones sí son gasto.
 * - Cada pago aparece una sola vez en la cuenta, enlazado al historial de
 *   la deuda, de modo que no se duplica en estadísticas.
 * - Nunca se calculan intereses que el usuario no haya registrado.
 */
class ManageDebts
{
    /**
     * @param  array{creditor: string, concept: string, principal: int, started_on: string, installment: int|null, frequency: Frequency|null, next_due_on: string|null, interest_rate: string|null, notes: string|null, disbursement_account: Account|null}  $data
     */
    public function create(User $user, array $data): Debt
    {
        if ($data['disbursement_account']?->isArchived()) {
            throw ValidationException::withMessages(['disbursement_account_id' => 'La cuenta está archivada.']);
        }

        return DB::transaction(function () use ($user, $data) {
            $debt = new Debt([
                ...collect($data)->except('disbursement_account')->all(),
                'currency' => $user->currency,
            ]);
            $debt->user()->associate($user);
            $debt->save();

            if ($data['disbursement_account'] !== null) {
                $movement = new Transaction([
                    'kind' => TransactionKind::DebtIn,
                    'status' => TransactionStatus::Confirmed,
                    'account_id' => $data['disbursement_account']->id,
                    'debt_id' => $debt->id,
                    'amount' => $debt->principal,
                    'currency' => $debt->currency,
                    'occurred_on' => $debt->started_on->toDateString(),
                    'concept' => "Préstamo recibido · {$debt->creditor}",
                ]);
                $movement->user()->associate($user);
                $movement->save();
            }

            return $debt;
        });
    }

    /**
     * @param  array{creditor: string, concept: string, principal: int, started_on: string, installment: int|null, frequency: Frequency|null, next_due_on: string|null, interest_rate: string|null, notes: string|null}  $data
     */
    public function update(Debt $debt, array $data): void
    {
        $hasPayments = $debt->payments()->whereNull('voided_at')->exists();

        if ($hasPayments && $data['principal'] !== $debt->principal) {
            throw ValidationException::withMessages([
                'principal' => 'La deuda ya tiene pagos registrados: el capital inicial no puede cambiarse.',
            ]);
        }

        DB::transaction(function () use ($debt, $data) {
            $debt->update($data);

            // El dinero recibido acompaña al capital inicial.
            $debt->disbursements()->whereNull('voided_at')->update([
                'amount' => $debt->principal,
                'occurred_on' => $debt->started_on->toDateString(),
            ]);
        });
    }

    /**
     * @param  array{account: Account, category: Category|null, paid_on: string, principal: int, interest: int, fees: int, notes: string|null, advances_schedule: bool, uuid?: string|null}  $data
     */
    public function recordPayment(Debt $debt, array $data): DebtPayment
    {
        if ($data['account']->isArchived()) {
            throw ValidationException::withMessages(['account_id' => 'La cuenta está archivada.']);
        }

        if ($data['principal'] + $data['interest'] + $data['fees'] === 0) {
            throw ValidationException::withMessages(['principal' => 'Indica al menos un importe del pago.']);
        }

        $charges = $data['interest'] + $data['fees'];

        if ($charges > 0 && $data['category'] === null) {
            throw ValidationException::withMessages(['category_id' => 'Elige la categoría de gasto para los intereses y comisiones.']);
        }

        if (! empty($data['uuid'])) {
            $existing = DebtPayment::query()->ownedBy($debt->user_id)->where('uuid', $data['uuid'])->first();

            if ($existing !== null) {
                return $existing;
            }
        }

        return DB::transaction(function () use ($debt, $data, $charges) {
            /** @var Debt $locked */
            $locked = Debt::query()->whereKey($debt->id)->lockForUpdate()->firstOrFail();
            $outstanding = $locked->outstanding();

            if ($data['principal'] > $outstanding) {
                throw ValidationException::withMessages([
                    'principal' => 'El capital supera lo pendiente ('.Money::toDecimal($outstanding, $locked->currency)." {$locked->currency}).",
                ]);
            }

            $payment = new DebtPayment([
                'debt_id' => $locked->id,
                'account_id' => $data['account']->id,
                'category_id' => $charges > 0 ? $data['category']?->id : null,
                'paid_on' => $data['paid_on'],
                'principal_amount' => $data['principal'],
                'interest_amount' => $data['interest'],
                'fees_amount' => $data['fees'],
                'currency' => $locked->currency,
                'notes' => $data['notes'],
            ]);
            if (! empty($data['uuid'])) {
                $payment->uuid = $data['uuid'];
            }
            $payment->user_id = $locked->user_id;
            $payment->save();

            $movements = [];
            if ($data['principal'] > 0) {
                $movements[] = [TransactionKind::DebtOut, $data['principal'], null, "Pago a {$locked->creditor} · capital"];
            }
            if ($charges > 0) {
                $movements[] = [TransactionKind::Expense, $charges, $data['category']?->id, "Pago a {$locked->creditor} · intereses y comisiones"];
            }

            foreach ($movements as [$kind, $amount, $categoryId, $concept]) {
                $movement = new Transaction([
                    'kind' => $kind,
                    'status' => TransactionStatus::Confirmed,
                    'account_id' => $data['account']->id,
                    'category_id' => $categoryId,
                    'debt_id' => $locked->id,
                    'debt_payment_id' => $payment->id,
                    'amount' => $amount,
                    'currency' => $locked->currency,
                    'occurred_on' => $data['paid_on'],
                    'concept' => $concept,
                ]);
                $movement->user_id = $locked->user_id;
                $movement->save();
            }

            $changes = [];
            if ($outstanding - $data['principal'] === 0) {
                $changes = ['settled_at' => now(), 'next_due_on' => null];
            } elseif ($data['advances_schedule'] && $locked->frequency !== null && $locked->next_due_on !== null) {
                $changes['next_due_on'] = $locked->frequency->occurrence($locked->next_due_on, 1)->toDateString();
            }

            if ($changes !== []) {
                $locked->update($changes);
            }

            return $payment;
        });
    }

    /**
     * Anula un pago y sus movimientos: el capital vuelve a estar pendiente.
     */
    public function voidPayment(DebtPayment $payment, string $reason): void
    {
        if ($payment->isVoided()) {
            throw ValidationException::withMessages(['payment' => 'El pago ya está anulado.']);
        }

        DB::transaction(function () use ($payment, $reason) {
            $now = now();
            $payment->update(['voided_at' => $now, 'void_reason' => $reason]);
            $payment->transactions()->update(['voided_at' => $now, 'void_reason' => $reason]);

            $debt = $payment->debt;
            if ($debt->isSettled() && $debt->outstanding() > 0) {
                $debt->update(['settled_at' => null]);
            }
        });
    }
}
