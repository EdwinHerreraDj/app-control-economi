<?php

namespace App\Http\Requests\Finance;

use App\Enums\Frequency;
use App\Models\Account;
use App\Models\Debt;
use App\Rules\MoneyAmount;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class DebtRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isUpdate = $this->route('debt') instanceof Debt;

        return [
            'creditor' => ['required', 'string', 'max:100'],
            'concept' => ['required', 'string', 'max:255'],
            'principal' => ['required', new MoneyAmount($this->currency())],
            'started_on' => ['required', 'date_format:Y-m-d'],
            'installment' => ['nullable', new MoneyAmount($this->currency())],
            'frequency' => ['nullable', 'required_with:next_due_on', Rule::enum(Frequency::class)],
            'next_due_on' => ['nullable', 'date_format:Y-m-d'],
            'interest_rate' => ['nullable', 'regex:/^\d{1,3}([.,]\d{1,4})?$/'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'disbursement_account_id' => $isUpdate
                ? ['prohibited']
                : ['nullable', 'integer', $this->ownedBy('accounts')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'creditor' => 'acreedor',
            'concept' => 'concepto',
            'principal' => 'capital inicial',
            'started_on' => 'fecha de inicio',
            'installment' => 'cuota',
            'frequency' => 'periodicidad',
            'next_due_on' => 'próximo vencimiento',
            'interest_rate' => 'tipo de interés',
            'notes' => 'notas',
            'disbursement_account_id' => 'cuenta donde lo recibiste',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['interest_rate.regex' => 'Escribe el tipo de interés como un porcentaje, por ejemplo 4,5.'];
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $rate = $this->optionalString('interest_rate');

        return [
            'creditor' => $this->string('creditor')->toString(),
            'concept' => $this->string('concept')->toString(),
            'principal' => (int) $this->minor('principal'),
            'started_on' => $this->string('started_on')->toString(),
            'installment' => $this->minor('installment'),
            'frequency' => $this->filled('frequency') ? Frequency::from($this->string('frequency')->toString()) : null,
            'next_due_on' => $this->optionalString('next_due_on'),
            'interest_rate' => $rate !== null ? str_replace(',', '.', $rate) : null,
            'notes' => $this->optionalString('notes'),
        ];
    }

    public function disbursementAccount(): ?Account
    {
        if (! $this->filled('disbursement_account_id')) {
            return null;
        }

        return Account::query()->ownedBy($this->owner())->whereKey($this->integer('disbursement_account_id'))->firstOrFail();
    }
}
