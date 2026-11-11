<?php

namespace App\Media;

/**
 * Lee las características reales de un archivo de imagen a partir de su
 * contenido (no de su extensión ni del tipo que declare el navegador).
 */
final class ImageInspector
{
    /**
     * @return array{mime: string, width: int|null, height: int|null, animated: bool, duration_ms: int|null, opaque_corners: bool|null, sizes?: list<int>}|null
     */
    public function inspect(string $bytes): ?array
    {
        if ($this->looksLikeSvg($bytes)) {
            return ['mime' => 'image/svg+xml', 'width' => null, 'height' => null, 'animated' => false, 'duration_ms' => null, 'opaque_corners' => null];
        }

        if (str_starts_with($bytes, "\x00\x00\x01\x00")) {
            return $this->inspectIco($bytes);
        }

        $info = @getimagesizefromstring($bytes);

        if ($info === false || ! in_array($info['mime'], ['image/png', 'image/webp', 'image/gif'], true)) {
            return null;
        }

        $duration = $info['mime'] === 'image/webp' ? $this->webpDuration($bytes) : null;

        return [
            'mime' => $info['mime'],
            'width' => $info[0],
            'height' => $info[1],
            'animated' => $duration !== null,
            'duration_ms' => $duration,
            'opaque_corners' => $info['mime'] === 'image/png' ? $this->opaqueCorners($bytes) : null,
        ];
    }

    private function looksLikeSvg(string $bytes): bool
    {
        $head = ltrim(substr($bytes, 0, 1024));

        return (bool) preg_match('/^(<\?xml[^>]*>\s*)?(<!--.*?-->\s*)*<svg[\s>]/is', $head);
    }

    /**
     * ICO: cabecera de 6 bytes y una entrada de 16 bytes por imagen.
     *
     * @return array{mime: string, width: int|null, height: int|null, animated: bool, duration_ms: int|null, opaque_corners: bool|null, sizes?: list<int>}|null
     */
    private function inspectIco(string $bytes): ?array
    {
        $header = unpack('v', substr($bytes, 4, 2));
        $count = is_array($header) ? (int) ($header[1] ?? 0) : 0;

        if ($count < 1 || $count > 16 || strlen($bytes) < 6 + 16 * $count) {
            return null;
        }

        $sizes = [];
        for ($i = 0; $i < $count; $i++) {
            $width = ord($bytes[6 + 16 * $i]);
            $sizes[] = $width === 0 ? 256 : $width;
        }
        sort($sizes);

        return ['mime' => 'image/x-icon', 'width' => max($sizes), 'height' => max($sizes), 'animated' => false, 'duration_ms' => null, 'opaque_corners' => null, 'sizes' => $sizes];
    }

    /**
     * Duración total de un WebP animado (suma de las tramas ANMF), o null si
     * no es animado.
     */
    private function webpDuration(string $bytes): ?int
    {
        if (substr($bytes, 0, 4) !== 'RIFF' || substr($bytes, 8, 4) !== 'WEBP') {
            return null;
        }

        $offset = 12;
        $total = 0;
        $frames = 0;
        $length = strlen($bytes);

        while ($offset + 8 <= $length) {
            $type = substr($bytes, $offset, 4);
            $chunk = unpack('V', substr($bytes, $offset + 4, 4));

            if (! is_array($chunk) || ! isset($chunk[1])) {
                return null; // archivo truncado o malformado
            }

            $size = (int) $chunk[1];

            if ($type === 'ANMF' && $offset + 8 + 16 <= $length) {
                // Duración: 24 bits a partir del byte 12 de la trama.
                $d = substr($bytes, $offset + 8 + 12, 3);
                $total += ord($d[0]) | (ord($d[1]) << 8) | (ord($d[2]) << 16);
                $frames++;
            }

            $offset += 8 + $size + ($size % 2);
        }

        return $frames > 1 ? $total : null;
    }

    /** ¿Son opacas las cuatro esquinas? (los iconos maskable necesitan fondo). */
    private function opaqueCorners(string $bytes): ?bool
    {
        $image = @imagecreatefromstring($bytes);

        if ($image === false) {
            return null;
        }

        $w = imagesx($image) - 1;
        $h = imagesy($image) - 1;

        foreach ([[0, 0], [$w, 0], [0, $h], [$w, $h]] as [$x, $y]) {
            if (((imagecolorat($image, $x, $y) >> 24) & 0x7F) > 0) {
                return false;
            }
        }

        return true;
    }
}
