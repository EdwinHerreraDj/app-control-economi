<?php

namespace App\Http\Requests\Finance;

use App\Models\Account;
use App\Models\Category;
use App\Rules\MoneyAmount;
use Illuminate\Contracts\Validation\ValidationRule;

class DebtPaymentRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $money = new MoneyAmount($this->currency(), allowZero: true);

        return [
            'uuid' => ['nullable', 'uuid'],
            'account_id' => ['required', 'integer', $this->ownedBy('accounts')],
            'category_id' => ['nullable', 'integer', $this->ownedBy('categories')->where('kind', 'expense')],
            'paid_on' => ['required', 'date_format:Y-m-d'],
            'principal' => ['required', $money],
            'interest' => ['nullable', $money],
            'fees' => ['nullable', $money],
            'notes' => ['nullable', 'string', 'max:2000'],
            'advances_schedule' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'account_id' => 'cuenta',
            'category_id' => 'categoría',
            'paid_on' => 'fecha de pago',
            'principal' => 'capital',
            'interest' => 'intereses',
            'fees' => 'comisiones',
            'notes' => 'notas',
        ];
    }

    /**
     * @return array{account: Account, category: Category|null, paid_on: string, principal: int, interest: int, fees: int, notes: string|null, advances_schedule: bool, uuid: string|null}
     */
    public function payload(): array
    {
        return [
            'uuid' => $this->optionalString('uuid'),
            'account' => Account::query()->ownedBy($this->owner())->whereKey($this->integer('account_id'))->firstOrFail(),
            'category' => $this->filled('category_id')
                ? Category::query()->ownedBy($this->owner())->whereKey($this->integer('category_id'))->firstOrFail()
                : null,
            'paid_on' => $this->string('paid_on')->toString(),
            'principal' => $this->minor('principal') ?? 0,
            'interest' => $this->minor('interest') ?? 0,
            'fees' => $this->minor('fees') ?? 0,
            'notes' => $this->optionalString('notes'),
            'advances_schedule' => $this->boolean('advances_schedule'),
        ];
    }
}
