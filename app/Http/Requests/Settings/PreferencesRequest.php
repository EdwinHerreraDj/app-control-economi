<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PreferencesRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'currency' => ['required', 'string', Rule::in(array_keys(config('money.currencies')))],
            'number_locale' => ['required', 'string', Rule::in(array_keys(config('money.number_locales')))],
            'timezone' => ['required', 'string', 'timezone:all'],
            'locale' => ['required', 'string', Rule::in(array_keys(config('money.locales')))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'currency' => 'moneda',
            'number_locale' => 'formato regional',
            'timezone' => 'zona horaria',
            'locale' => 'idioma',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'currency.required' => 'Elige tu moneda principal.',
            'currency.in' => 'Elige una moneda de la lista.',
        ];
    }
}
