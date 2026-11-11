<?php

namespace App\Http\Requests\Finance;

use App\Enums\TransactionStatus;
use App\Models\Account;
use App\Rules\MoneyAmount;
use App\Support\Money;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class TransferRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'from_account_id' => ['required', 'integer', $this->ownedBy('accounts')],
            'to_account_id' => ['required', 'integer', 'different:from_account_id', $this->ownedBy('accounts')],
            'amount' => ['required', new MoneyAmount($this->currency())],
            'occurred_on' => ['required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::enum(TransactionStatus::class)],
            'concept' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'from_account_id' => 'cuenta de origen',
            'to_account_id' => 'cuenta de destino',
            'amount' => 'importe',
            'occurred_on' => 'fecha',
            'status' => 'estado',
            'concept' => 'concepto',
            'notes' => 'notas',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['to_account_id.different' => 'Elige dos cuentas distintas.'];
    }

    /**
     * @return array{from: Account, to: Account, amount: int, occurred_on: string, status: TransactionStatus, concept: string|null, notes: string|null}
     */
    public function payload(): array
    {
        $account = fn (string $field): Account => Account::query()
            ->ownedBy($this->owner())
            ->whereKey($this->integer($field))
            ->firstOrFail();

        return [
            'from' => $account('from_account_id'),
            'to' => $account('to_account_id'),
            'amount' => Money::toMinor($this->string('amount')->toString(), $this->currency()),
            'occurred_on' => $this->string('occurred_on')->toString(),
            'status' => TransactionStatus::from($this->string('status')->toString()),
            'concept' => $this->filled('concept') ? $this->string('concept')->toString() : null,
            'notes' => $this->filled('notes') ? $this->string('notes')->toString() : null,
        ];
    }
}
