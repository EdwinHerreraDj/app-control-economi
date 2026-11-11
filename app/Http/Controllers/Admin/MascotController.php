<?php

namespace App\Http\Controllers\Admin;

use App\Enums\MascotState;
use App\Http\Controllers\Controller;
use App\Mascots\MessageRenderer;
use App\Media\MediaStore;
use App\Models\AuditLog;
use App\Models\Mascot;
use App\Models\MascotAsset;
use App\Models\MascotMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Administración → Mascotas (CONTEXT.md §9).
 */
class MascotController extends Controller
{
    private const STATUS_LABELS = ['draft' => 'Borrador', 'published' => 'Publicada', 'archived' => 'Archivada'];

    public function index(): Response
    {
        $mascots = Mascot::query()->with('assets')->orderByDesc('is_default')->orderBy('name')->get();

        return Inertia::render('admin/mascots/index', [
            'mascots' => $mascots->map(fn (Mascot $mascot) => $this->summary($mascot)),
            'messages' => MascotMessage::query()->whereNull('mascot_id')->orderBy('state')->orderBy('id')->get()
                ->map(fn (MascotMessage $message) => [
                    'id' => $message->id,
                    'state' => $message->state,
                    'template' => $message->template,
                    'active' => $message->active,
                ]),
            'states' => $this->states(),
            'variables' => collect(MessageRenderer::VARIABLES)->map(fn ($description, $key) => ['key' => $key, 'description' => $description])->values(),
        ]);
    }

    public function show(Mascot $mascot, MessageRenderer $renderer): Response
    {
        $mascot->load(['assets.media', 'assets.animated']);
        $assets = $mascot->assets->keyBy('state');

        // Ejemplo de mensajes con valores ficticios para la vista previa.
        $sample = ['nombre' => 'Lucía', 'mascota' => $mascot->name, 'fecha' => '20 de noviembre', 'faltante' => '85,00 €', 'saldo_minimo' => '120,00 €', 'objetivo' => 'Vacaciones'];

        return Inertia::render('admin/mascots/show', [
            'mascot' => $this->summary($mascot),
            'slots' => collect(MascotState::cases())->map(function (MascotState $state) use ($assets) {
                /** @var MascotAsset|null $asset */
                $asset = $assets->get($state->value);

                return [
                    'state' => $state->value,
                    'label' => $state->label(),
                    'description' => $state->description(),
                    'required' => $state->isRequired(),
                    'static' => $asset?->media ? ['url' => $asset->media->url(), 'width' => $asset->media->width, 'height' => $asset->media->height, 'size' => $asset->media->size] : null,
                    'animated' => $asset?->animated ? ['url' => $asset->animated->url(), 'duration_ms' => $asset->animated->duration_ms, 'size' => $asset->animated->size] : null,
                ];
            }),
            'previewMessages' => collect(MascotState::moods())->mapWithKeys(fn (MascotState $state) => [
                $state->value => MascotMessage::query()->where('state', $state->value)->where('active', true)
                    ->where(fn ($q) => $q->where('mascot_id', $mascot->id)->orWhereNull('mascot_id'))
                    ->pluck('template')->map(fn (string $template) => $renderer->render($template, $sample))->values(),
            ]),
            'limits' => config('branding.mascot'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateDetails($request);

        $mascot = Mascot::create([
            ...$validated,
            'slug' => $this->uniqueSlug($validated['name']),
            'status' => 'draft',
        ]);
        AuditLog::record('mascot.created', $mascot);

        return redirect()->route('admin.mascots.show', $mascot);
    }

    public function update(Request $request, Mascot $mascot): RedirectResponse
    {
        $mascot->update($this->validateDetails($request));
        $this->toast('Datos de la mascota guardados.');

        return back();
    }

    /** Sube la imagen estática o la animada de un estado. */
    public function uploadAsset(Request $request, Mascot $mascot, string $state, MediaStore $store): RedirectResponse
    {
        $state = MascotState::tryFrom($state) ?? abort(404);
        $validated = $request->validate([
            'file' => ['required', 'file'],
            'variant' => ['required', Rule::in(['static', 'animated'])],
        ], attributes: ['file' => 'archivo']);

        $asset = MascotAsset::query()->where('mascot_id', $mascot->id)->where('state', $state->value)->first();

        if ($validated['variant'] === 'animated' && $asset === null) {
            throw ValidationException::withMessages(['file' => 'Sube primero la imagen estática de este estado: es la alternativa cuando no hay animación.']);
        }

        /** @var array{mimes: list<string>, max_kb: int} $rules */
        $rules = config("branding.mascot.{$validated['variant']}");
        $media = $store->storeUpload($request->file('file'), 'mascots', $rules);

        if ($validated['variant'] === 'static') {
            MascotAsset::query()->updateOrCreate(
                ['mascot_id' => $mascot->id, 'state' => $state->value],
                ['media_asset_id' => $media->id],
            );
        } else {
            $asset?->update(['animated_media_asset_id' => $media->id]);
        }

        AuditLog::record('mascot.asset_uploaded', $mascot, ['state' => $state->value, 'variant' => $validated['variant']]);
        $this->toast("Imagen de «{$state->label()}» actualizada.");

        return back();
    }

    public function removeAsset(Request $request, Mascot $mascot, string $state): RedirectResponse
    {
        $state = MascotState::tryFrom($state) ?? abort(404);
        $variant = $request->string('variant')->toString();
        $asset = MascotAsset::query()->where('mascot_id', $mascot->id)->where('state', $state->value)->firstOrFail();

        if ($variant === 'animated') {
            $asset->update(['animated_media_asset_id' => null]);
        } else {
            if ($state->isRequired() && $mascot->isPublished()) {
                throw ValidationException::withMessages(['file' => 'Esta imagen es obligatoria en una mascota publicada.']);
            }
            $asset->delete();
        }

        $this->toast('Imagen quitada.');

        return back();
    }

    public function publish(Mascot $mascot): RedirectResponse
    {
        $mascot->load('assets');
        $missing = $mascot->missingRequired();

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'mascot' => 'Faltan imágenes obligatorias: '.implode(', ', array_map(fn (MascotState $s) => $s->label(), $missing)).'.',
            ]);
        }

        $mascot->update(['status' => 'published']);
        AuditLog::record('mascot.published', $mascot);
        $this->toast("«{$mascot->name}» está publicada y ya se puede elegir.");

        return back();
    }

    /** Archivar la retira del catálogo conservando sus imágenes. */
    public function archive(Mascot $mascot): RedirectResponse
    {
        if ($mascot->is_default) {
            throw ValidationException::withMessages(['mascot' => 'Es la mascota que ven todos: elige otra predeterminada antes de archivar esta.']);
        }

        $mascot->update(['status' => 'archived']);
        AuditLog::record('mascot.archived', $mascot);
        $this->toast("«{$mascot->name}» se ha archivado.");

        return back();
    }

    public function makeDefault(Mascot $mascot): RedirectResponse
    {
        if (! $mascot->isPublished()) {
            throw ValidationException::withMessages(['mascot' => 'Solo una mascota publicada puede ser la predeterminada.']);
        }

        DB::transaction(function () use ($mascot) {
            Mascot::query()->where('is_default', true)->update(['is_default' => false]);
            $mascot->update(['is_default' => true]);
        });
        AuditLog::record('mascot.made_default', $mascot);
        $this->toast("«{$mascot->name}» es ahora la mascota de todas las personas.");

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Mascot $mascot): array
    {
        $present = $mascot->assets->pluck('state')->all();

        return [
            'id' => $mascot->id,
            'slug' => $mascot->slug,
            'name' => $mascot->name,
            'description' => $mascot->description,
            'status' => $mascot->status,
            'status_label' => self::STATUS_LABELS[$mascot->status] ?? $mascot->status,
            'is_default' => $mascot->is_default,
            'cover' => $mascot->images()[MascotState::Cover->value]['static'],
            'missing_required' => array_map(fn (MascotState $s) => $s->label(), $mascot->missingRequired()),
            'missing_optional' => collect(MascotState::moods())
                ->reject(fn (MascotState $s) => $s->isRequired() || in_array($s->value, $present, true))
                ->map(fn (MascotState $s) => $s->label())->values(),
        ];
    }

    /**
     * @return list<array{value: string, label: string, description: string}>
     */
    private function states(): array
    {
        return array_map(fn (MascotState $s) => ['value' => $s->value, 'label' => $s->label(), 'description' => $s->description()], MascotState::moods());
    }

    /**
     * @return array{name: string, description: string|null}
     */
    private function validateDetails(Request $request): array
    {
        /** @var array{name: string, description: string|null} */
        return $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:500'],
        ], attributes: ['name' => 'nombre', 'description' => 'descripción']);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'mascota';
        $slug = $base;

        for ($i = 2; Mascot::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
