<?php

namespace App\Http\Requests\Finance;

use App\Rules\MoneyAmount;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Aportación a un objetivo o retirada de lo reservado.
 */
class ContributionRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'direction' => ['required', Rule::in(['deposit', 'withdraw'])],
            'amount' => ['required', new MoneyAmount($this->currency())],
            'contributed_on' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['amount' => 'importe', 'contributed_on' => 'fecha', 'note' => 'nota'];
    }

    public function signedAmount(): int
    {
        $amount = (int) $this->minor('amount');

        return $this->string('direction')->toString() === 'withdraw' ? -$amount : $amount;
    }
}
