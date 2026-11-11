<?php

namespace App\Http\Requests\Finance;

use App\Rules\MoneyAmount;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Alta y edición de un objetivo de ahorro.
 */
class SavingsGoalRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'target_amount' => ['required', new MoneyAmount($this->currency())],
            'target_date' => ['nullable', 'date_format:Y-m-d'],
            'icon' => ['required', Rule::in(config('finance.icons'))],
            'color' => ['required', Rule::in(config('finance.colors'))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['name' => 'nombre', 'target_amount' => 'meta', 'target_date' => 'fecha objetivo'];
    }

    /**
     * @return array{name: string, target_amount: int, target_date: string|null, icon: string, color: string}
     */
    public function payload(): array
    {
        return [
            'name' => $this->string('name')->toString(),
            'target_amount' => (int) $this->minor('target_amount'),
            'target_date' => $this->optionalString('target_date'),
            'icon' => $this->string('icon')->toString(),
            'color' => $this->string('color')->toString(),
        ];
    }
}
