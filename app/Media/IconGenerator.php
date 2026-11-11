<?php

namespace App\Media;

use GdImage;
use InvalidArgumentException;

/**
 * Genera las variantes de iconos (PWA, Apple, favicon) a partir de un
 * original cuadrado de al menos 512 px (recomendado 1024 px).
 */
final class IconGenerator
{
    /**
     * @return array<string, string> Clave de recurso → bytes del archivo.
     */
    public function fromSource(string $png, string $backgroundHex): array
    {
        $source = @imagecreatefromstring($png);

        if (! $source instanceof GdImage) {
            throw new InvalidArgumentException('No se pudo leer la imagen original.');
        }

        if (imagesx($source) !== imagesy($source) || imagesx($source) < 512) {
            throw new InvalidArgumentException('El original debe ser cuadrado y de al menos 512 px.');
        }

        return [
            'logo_square' => $this->png($this->resize($source, 512)),
            'pwa_512' => $this->png($this->resize($source, 512)),
            'pwa_192' => $this->png($this->resize($source, 192)),
            // Apple no admite transparencia: se compone sobre el color de fondo.
            'apple_touch' => $this->png($this->onBackground($source, 180, 1.0, $backgroundHex)),
            // Maskable: fondo opaco y todo el original dentro del círculo central
            // del 80 %: un cuadrado inscrito en él mide 0,8 / √2 del lado.
            'pwa_maskable' => $this->png($this->onBackground($source, 512, 0.8 / M_SQRT2, $backgroundHex)),
            'favicon_ico' => $this->ico([
                16 => $this->png($this->resize($source, 16)),
                32 => $this->png($this->resize($source, 32)),
                48 => $this->png($this->resize($source, 48)),
            ]),
        ];
    }

    private function resize(GdImage $source, int $size): GdImage
    {
        $target = $this->canvas($size);
        imagecopyresampled($target, $source, 0, 0, 0, 0, $size, $size, imagesx($source), imagesy($source));

        return $target;
    }

    /**
     * @param  float  $scale  Proporción del lienzo que ocupa el contenido.
     */
    private function onBackground(GdImage $source, int $size, float $scale, string $hex): GdImage
    {
        $target = imagecreatetruecolor(max(1, $size), max(1, $size));
        [$r, $g, $b] = Color::rgb($hex);
        imagefill($target, 0, 0, (int) imagecolorallocate($target, $r, $g, $b));
        imagealphablending($target, true);

        $inner = (int) round($size * min(1.0, $scale));
        $offset = intdiv($size - $inner, 2);
        imagecopyresampled($target, $source, $offset, $offset, 0, 0, $inner, $inner, imagesx($source), imagesy($source));

        return $target;
    }

    private function canvas(int $size): GdImage
    {
        $image = imagecreatetruecolor(max(1, $size), max(1, $size));
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, (int) imagecolorallocatealpha($image, 0, 0, 0, 127));

        return $image;
    }

    private function png(GdImage $image): string
    {
        imagesavealpha($image, true);
        ob_start();
        imagepng($image, null, 9);

        return (string) ob_get_clean();
    }

    /**
     * ICO con imágenes PNG embebidas (admitido por todos los navegadores actuales).
     *
     * @param  array<int, string>  $images  Tamaño → bytes PNG.
     */
    private function ico(array $images): string
    {
        $header = pack('vvv', 0, 1, count($images));
        $directory = '';
        $data = '';
        $offset = 6 + 16 * count($images);

        foreach ($images as $size => $bytes) {
            $directory .= pack('CCCCvvVV', $size >= 256 ? 0 : $size, $size >= 256 ? 0 : $size, 0, 0, 1, 32, strlen($bytes), $offset);
            $data .= $bytes;
            $offset += strlen($bytes);
        }

        return $header.$directory.$data;
    }
}
