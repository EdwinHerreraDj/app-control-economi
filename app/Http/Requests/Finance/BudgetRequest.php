<?php

namespace App\Http\Requests\Finance;

use App\Rules\MoneyAmount;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Límite mensual de un presupuesto.
 */
class BudgetRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['amount' => ['required', new MoneyAmount($this->currency())]];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['amount' => 'límite mensual'];
    }
}
