<?php

namespace App\Http\Requests\Finance;

use App\Enums\AccountType;
use App\Rules\MoneyAmount;
use App\Support\Money;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class AccountRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', Rule::enum(AccountType::class)],
            'initial_balance' => ['required', new MoneyAmount($this->currency(), allowNegative: true, allowZero: true)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['name' => 'nombre', 'type' => 'tipo', 'initial_balance' => 'saldo inicial'];
    }

    public function initialBalance(): int
    {
        return Money::toMinor((string) $this->validated('initial_balance'), $this->currency(), allowNegative: true);
    }
}
