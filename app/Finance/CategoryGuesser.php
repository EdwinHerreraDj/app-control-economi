<?php

namespace App\Finance;

use App\Enums\CategoryKind;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Sugiere la categoría de un movimiento a partir de lo que escribe la
 * persona. Primero manda su propio historial («cerveza» → la categoría que
 * eligió la última vez) y, si no hay, las palabras clave de la configuración.
 */
class CategoryGuesser
{
    /**
     * Palabras clave resueltas a las categorías activas del usuario.
     *
     * @return list<array{category_id: int, words: list<string>}>
     */
    public function keywords(User $user, CategoryKind $kind): array
    {
        /** @var array<string, list<string>> $map */
        $map = config("finance.category_keywords.{$kind->value}", []);
        $categories = $this->categories($user, $kind)->keyBy(fn (Category $c) => mb_strtolower($c->name));

        $result = [];
        foreach ($map as $name => $words) {
            $category = $categories->get(mb_strtolower($name));
            if ($category !== null) {
                $result[] = ['category_id' => $category->id, 'words' => $words];
            }
        }

        return $result;
    }

    /**
     * Conceptos usados recientemente con su categoría, del más frecuente al
     * menos (para sugerir y para autocompletar).
     *
     * @return list<array{concept: string, category_id: int}>
     */
    public function history(User $user, CategoryKind $kind, int $limit = 40): array
    {
        return array_values(Transaction::query()->ownedBy($user)
            ->where('kind', $kind->value)
            ->whereNull('voided_at')
            ->whereNull('debt_payment_id')
            ->whereNotNull('category_id')
            ->where('occurred_on', '>=', $user->today()->subMonths(6)->toDateString())
            ->groupBy('concept', 'category_id')
            ->selectRaw('concept, category_id, COUNT(*) AS times, MAX(id) AS latest')
            ->orderByDesc('times')
            ->orderByDesc('latest')
            ->limit($limit)
            ->get()
            ->unique(fn (Transaction $t) => mb_strtolower($t->concept))
            ->map(fn (Transaction $t) => ['concept' => $t->concept, 'category_id' => (int) $t->category_id])
            ->all());
    }

    public function guess(User $user, CategoryKind $kind, string $concept): ?Category
    {
        $categories = $this->categories($user, $kind);
        $text = ' '.Str::lower(Str::ascii($concept)).' ';

        foreach ($this->history($user, $kind) as $item) {
            if (Str::lower(Str::ascii($item['concept'])) === trim($text)) {
                return $categories->firstWhere('id', $item['category_id']);
            }
        }

        foreach ($this->keywords($user, $kind) as $entry) {
            foreach ($entry['words'] as $word) {
                // Palabra completa (o su plural): «gas» no debe coincidir con «gasolina».
                $pattern = '/(^|\s)'.preg_quote(Str::lower(Str::ascii($word)), '/').'(s|es)?(\s|$)/u';
                if (preg_match($pattern, $text) === 1) {
                    return $categories->firstWhere('id', $entry['category_id']);
                }
            }
        }

        return null;
    }

    /** Categoría de reserva («Otros gastos» / «Otros ingresos») o la primera. */
    public function fallback(User $user, CategoryKind $kind): ?Category
    {
        $categories = $this->categories($user, $kind);
        $name = $kind === CategoryKind::Income ? 'otros ingresos' : 'otros gastos';

        return $categories->first(fn (Category $c) => mb_strtolower($c->name) === $name) ?? $categories->first();
    }

    /**
     * @return Collection<int, Category>
     */
    private function categories(User $user, CategoryKind $kind): Collection
    {
        return Category::query()->ownedBy($user)->active()->where('kind', $kind->value)->orderBy('name')->get();
    }
}
