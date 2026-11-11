<?php

namespace App\Http\Requests\Finance;

use App\Enums\CategoryKind;
use App\Models\Category;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class CategoryRequest extends FinanceRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Category|null $category */
        $category = $this->route('category');
        // El tipo (ingreso/gasto) no cambia al editar: el historial depende de él.
        $kind = $category?->kind->value ?? $this->input('kind');

        return [
            'kind' => $category ? ['prohibited'] : ['required', Rule::enum(CategoryKind::class)],
            'name' => [
                'required', 'string', 'max:60',
                Rule::unique('categories', 'name')
                    ->where('user_id', $this->owner()->getKey())
                    ->where('kind', $kind)
                    ->ignore($category?->getKey()),
            ],
            'icon' => ['required', Rule::in(config('finance.icons'))],
            'color' => ['required', Rule::in(config('finance.colors'))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['kind' => 'tipo', 'name' => 'nombre', 'icon' => 'icono', 'color' => 'color'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['name.unique' => 'Ya tienes una categoría con ese nombre.'];
    }
}
