<?php

namespace App\Http\Controllers\Finance;

use App\Enums\CategoryKind;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\CategoryRequest;
use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function index(Request $request): Response
    {
        $categories = Category::query()
            ->ownedBy($request->user())
            ->withCount('transactions')
            ->orderByRaw('archived_at IS NOT NULL')
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'kind' => $category->kind->value,
                'name' => $category->name,
                'icon' => $category->icon,
                'color' => $category->color,
                'archived' => $category->isArchived(),
                'transactions_count' => $category->transactions_count,
            ]);

        return Inertia::render('finance/categories/index', [
            'categories' => $categories,
            'icons' => config('finance.icons'),
            'colors' => config('finance.colors'),
        ]);
    }

    public function store(CategoryRequest $request): RedirectResponse
    {
        $category = new Category([
            'kind' => CategoryKind::from($request->validated('kind')),
            ...$request->safe()->only(['name', 'icon', 'color']),
        ]);
        $category->user()->associate($request->user());
        $category->save();

        $this->toast('Categoría creada.');

        return back();
    }

    public function update(CategoryRequest $request, Category $category): RedirectResponse
    {
        Gate::authorize('update', $category);

        $category->update($request->safe()->only(['name', 'icon', 'color']));
        $this->toast('Categoría actualizada.');

        return back();
    }

    /**
     * Archivar conserva el historial: los movimientos siguen mostrando la
     * categoría, pero no se puede elegir para movimientos nuevos.
     */
    public function archive(Category $category): RedirectResponse
    {
        Gate::authorize('update', $category);

        $category->forceFill(['archived_at' => now()])->save();
        $this->toast("«{$category->name}» se ha archivado.");

        return back();
    }

    public function restore(Category $category): RedirectResponse
    {
        Gate::authorize('update', $category);

        $category->forceFill(['archived_at' => null])->save();
        $this->toast("«{$category->name}» vuelve a estar disponible.");

        return back();
    }
}
