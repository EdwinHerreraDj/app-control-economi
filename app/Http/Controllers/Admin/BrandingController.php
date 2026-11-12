<?php

namespace App\Http\Controllers\Admin;

use App\Branding\Brand;
use App\Http\Controllers\Controller;
use App\Media\Color;
use App\Media\IconGenerator;
use App\Media\MediaStore;
use App\Models\AuditLog;
use App\Models\MediaAsset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

/**
 * Administración → Identidad visual (CONTEXT.md §11).
 */
class BrandingController extends Controller
{
    private const HEX = '/^#[0-9a-fA-F]{6}$/';

    public function edit(Brand $brand): Response
    {
        $resolved = $brand->resolved();
        /** @var array<string, array<string, mixed>> $definitions */
        $definitions = config('branding.assets');

        return Inertia::render('admin/branding/index', [
            'settings' => collect($brand->settings())->except('assets'),
            'assets' => collect($definitions)->map(fn (array $definition, string $key) => [
                'key' => $key,
                'label' => $definition['label'],
                'help' => $definition['help'],
                'accept' => implode(',', $definition['mimes']),
                'max_kb' => $definition['max_kb'],
                'preview' => $definition['preview'],
                'url' => $resolved['urls'][$key] ?? null,
                'custom' => $resolved['custom'][$key] ?? false,
            ])->values(),
        ]);
    }

    public function update(Request $request, Brand $brand): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'short_name' => ['required', 'string', 'max:15'],
            'theme_color' => ['required', 'regex:'.self::HEX],
            'background_color' => ['required', 'regex:'.self::HEX],
            'primary_color' => ['nullable', 'regex:'.self::HEX],
        ], [
            'theme_color.regex' => 'Usa un color hexadecimal, por ejemplo #4f3ff0.',
            'background_color.regex' => 'Usa un color hexadecimal, por ejemplo #f8f7fd.',
            'primary_color.regex' => 'Usa un color hexadecimal, por ejemplo #4f3ff0.',
        ], [
            'name' => 'nombre', 'short_name' => 'nombre corto', 'theme_color' => 'color de la barra',
            'background_color' => 'color de fondo', 'primary_color' => 'color principal',
        ]);

        // El texto de los botones principales es blanco: exige contraste AA.
        if (! empty($validated['primary_color']) && Color::contrast($validated['primary_color'], '#ffffff') < 4.5) {
            throw ValidationException::withMessages([
                'primary_color' => sprintf(
                    'Contraste insuficiente con el texto blanco (%.1f:1; mínimo 4,5:1). Prueba un tono más oscuro.',
                    Color::contrast($validated['primary_color'], '#ffffff'),
                ),
            ]);
        }

        $brand->update([...$validated, 'primary_color' => $validated['primary_color'] ?? null]);
        AuditLog::record('brand.updated', properties: ['fields' => array_keys($validated)]);
        $this->toast('Identidad guardada.');

        return back();
    }

    /** Sube un recurso concreto (logotipo, favicon, icono...). */
    public function upload(Request $request, string $asset, Brand $brand, MediaStore $store): RedirectResponse
    {
        $definition = $this->definition($asset);
        $request->validate(['file' => ['required', 'file']], attributes: ['file' => 'archivo']);

        $media = $store->storeUpload($request->file('file'), 'brand', $definition);

        if ($asset === 'source') {
            // El original se guarda y se generan sus variantes.
            $this->generate($media, $brand, $store);
        }

        $brand->update(['assets' => [$asset => $media->id]]);
        AuditLog::record('brand.asset_uploaded', properties: ['asset' => $asset]);
        $this->toast($asset === 'source'
            ? 'Original subido. Se han generado los iconos PWA, el de Apple, el favicon y el logo cuadrado.'
            : "«{$definition['label']}» actualizado.");

        return back();
    }

    /** Vuelve al recurso por defecto. */
    public function reset(string $asset, Brand $brand): RedirectResponse
    {
        $definition = $this->definition($asset);
        $brand->update(['assets' => [$asset => null]]);
        AuditLog::record('brand.asset_reset', properties: ['asset' => $asset]);
        $this->toast("«{$definition['label']}» vuelve al valor por defecto.");

        return back();
    }

    private function generate(MediaAsset $source, Brand $brand, MediaStore $store): void
    {
        try {
            $icons = app(IconGenerator::class)->fromSource(
                (string) Storage::disk($source->disk)->get($source->path),
                $brand->settings()['theme_color'],
            );
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        /** @var array<string, array{mimes: list<string>, max_kb: int}> $definitions */
        $definitions = config('branding.assets');

        DB::transaction(function () use ($icons, $definitions, $brand, $store) {
            $ids = [];
            foreach ($icons as $key => $bytes) {
                $ids[$key] = $store->store($bytes, 'brand', $definitions[$key])->id;
            }
            $brand->update(['assets' => $ids]);
        });
    }

    /**
     * @return array{label: string, mimes: list<string>, max_kb: int}
     */
    private function definition(string $asset): array
    {
        /** @var array{label: string, mimes: list<string>, max_kb: int}|null $definition */
        $definition = config("branding.assets.{$asset}");
        abort_if($definition === null, 404);

        return $definition;
    }
}
