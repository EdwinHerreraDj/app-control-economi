<?php

namespace App\Media;

use App\Models\MediaAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Guarda archivos validados en el almacenamiento persistente.
 *
 * Valida el contenido real (no la extensión), las medidas, el peso y, en
 * las animaciones, la duración. Nunca acepta formatos ejecutables.
 */
final class MediaStore
{
    private const EXTENSIONS = [
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'image/svg+xml' => 'svg',
        'image/x-icon' => 'ico',
    ];

    public function __construct(
        private readonly ImageInspector $inspector,
        private readonly SvgSanitizer $sanitizer,
    ) {}

    /**
     * @param  array{mimes: list<string>, max_kb: int, width?: int, height?: int, min_width?: int, square?: bool, opaque?: bool, max_duration_ms?: int, ico_sizes?: list<int>}  $rules
     */
    public function storeUpload(UploadedFile $file, string $purpose, array $rules, string $field = 'file'): MediaAsset
    {
        $bytes = (string) file_get_contents($file->getRealPath());

        return $this->store($bytes, $purpose, $rules, $field);
    }

    /**
     * @param  array{mimes: list<string>, max_kb: int, width?: int, height?: int, min_width?: int, square?: bool, opaque?: bool, max_duration_ms?: int, ico_sizes?: list<int>}  $rules
     */
    public function store(string $bytes, string $purpose, array $rules, string $field = 'file'): MediaAsset
    {
        $fail = fn (string $message) => throw ValidationException::withMessages([$field => $message]);

        if (strlen($bytes) > $rules['max_kb'] * 1024) {
            $fail("El archivo pesa más de {$rules['max_kb']} KB.");
        }

        $info = $this->inspector->inspect($bytes);

        if ($info === null || ! in_array($info['mime'], $rules['mimes'], true)) {
            $fail('El contenido del archivo no es un formato admitido ('.$this->describe($rules['mimes']).').');
        }

        if ($info['mime'] === 'image/svg+xml') {
            try {
                $bytes = $this->sanitizer->sanitize($bytes);
            } catch (InvalidArgumentException $e) {
                $fail($e->getMessage());
            }
        }

        [$w, $h] = [$info['width'], $info['height']];

        if (isset($rules['width'], $rules['height']) && $w !== null && ($w !== $rules['width'] || $h !== $rules['height'])) {
            $fail("Debe medir exactamente {$rules['width']} × {$rules['height']} px (mide {$w} × {$h} px).");
        }
        if (isset($rules['min_width']) && $w !== null && $w < $rules['min_width']) {
            $fail("Debe medir al menos {$rules['min_width']} px de ancho (mide {$w} px).");
        }
        if (($rules['square'] ?? false) && $w !== null && $w !== $h) {
            $fail("Debe ser cuadrada (mide {$w} × {$h} px).");
        }
        if (($rules['opaque'] ?? false) && $info['opaque_corners'] === false) {
            $fail('Un icono maskable necesita fondo opaco: las esquinas no pueden ser transparentes.');
        }
        if (isset($rules['max_duration_ms']) && $info['duration_ms'] !== null && $info['duration_ms'] > $rules['max_duration_ms']) {
            $fail('La animación dura demasiado (máximo '.($rules['max_duration_ms'] / 1000).' s por ciclo).');
        }
        if (isset($rules['ico_sizes'])) {
            $missing = array_diff($rules['ico_sizes'], $info['sizes'] ?? []);
            if ($missing !== []) {
                $fail('El ICO debe incluir los tamaños '.implode(', ', $rules['ico_sizes']).' px (faltan: '.implode(', ', $missing).').');
            }
        }

        $extension = self::EXTENSIONS[$info['mime']];
        $path = $purpose.'/'.Str::uuid()->toString().'.'.$extension;
        Storage::disk('public')->put($path, $bytes);

        return MediaAsset::create([
            'purpose' => $purpose,
            'disk' => 'public',
            'path' => $path,
            'mime' => $info['mime'],
            'size' => strlen($bytes),
            'width' => $w,
            'height' => $h,
            'duration_ms' => $info['duration_ms'],
            'checksum' => hash('sha256', $bytes),
            'uploaded_by' => Auth::id(),
        ]);
    }

    /**
     * @param  list<string>  $mimes
     */
    private function describe(array $mimes): string
    {
        return implode(', ', array_map(fn (string $mime) => strtoupper(self::EXTENSIONS[$mime] ?? $mime), $mimes));
    }
}
