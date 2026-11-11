<?php

namespace App\Http\Requests\Finance;

use App\Enums\ExpenseNature;
use App\Enums\Frequency;
use App\Enums\TransactionKind;
use App\Models\Account;
use App\Models\Category;
use App\Models\RecurringRule;
use App\Rules\MoneyAmount;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class RecurringRuleRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isUpdate = $this->route('rule') instanceof RecurringRule;

        return [
            'kind' => $isUpdate ? ['prohibited'] : ['required', Rule::in(['income', 'expense'])],
            'account_id' => ['required', 'integer', $this->ownedBy('accounts')],
            'category_id' => ['required', 'integer', $this->ownedBy('categories')],
            'amount' => ['required', new MoneyAmount($this->currency())],
            'concept' => ['required', 'string', 'max:255'],
            'nature' => ['nullable', Rule::enum(ExpenseNature::class)],
            'frequency' => ['required', Rule::enum(Frequency::class)],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
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
            'amount' => 'importe',
            'concept' => 'concepto',
            'nature' => 'tipo de gasto',
            'frequency' => 'frecuencia',
            'starts_on' => 'primera fecha',
            'ends_on' => 'fecha de fin',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        return [
            ...($this->filled('kind') ? ['kind' => TransactionKind::from($this->string('kind')->toString())] : []),
            'account' => Account::query()->ownedBy($this->owner())->whereKey($this->integer('account_id'))->firstOrFail(),
            'category' => Category::query()->ownedBy($this->owner())->whereKey($this->integer('category_id'))->firstOrFail(),
            'amount' => (int) $this->minor('amount'),
            'concept' => $this->string('concept')->toString(),
            'nature' => $this->filled('nature') ? ExpenseNature::from($this->string('nature')->toString()) : null,
            'frequency' => Frequency::from($this->string('frequency')->toString()),
            'starts_on' => $this->string('starts_on')->toString(),
            'ends_on' => $this->optionalString('ends_on'),
        ];
    }
}
