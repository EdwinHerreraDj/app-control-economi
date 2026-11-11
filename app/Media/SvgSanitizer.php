<?php

namespace App\Media;

use DOMDocument;
use DOMElement;
use DOMNode;
use InvalidArgumentException;

/**
 * Sanea un SVG subido: conserva solo elementos y atributos de dibujo y
 * elimina scripts, manejadores de eventos, contenido externo y enlaces.
 */
final class SvgSanitizer
{
    private const ELEMENTS = [
        'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
        'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'title', 'desc',
        'text', 'tspan', 'use', 'symbol',
    ];

    private const ATTRIBUTES = [
        'id', 'class', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
        'd', 'points', 'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap',
        'stroke-linejoin', 'stroke-opacity', 'stroke-miterlimit', 'stroke-dasharray', 'opacity', 'transform',
        'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'fx', 'fy',
        'clip-path', 'mask', 'preserveaspectratio', 'xmlns', 'version', 'font-family', 'font-size',
        'font-weight', 'text-anchor', 'dominant-baseline', 'href', 'xlink:href', 'style',
    ];

    public function sanitize(string $svg): string
    {
        if (str_contains($svg, '<!ENTITY') || str_contains($svg, '<!DOCTYPE')) {
            throw new InvalidArgumentException('El SVG no puede contener declaraciones DOCTYPE ni entidades.');
        }

        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($svg, LIBXML_NONET | LIBXML_NOBLANKS);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded || $document->documentElement?->localName !== 'svg') {
            throw new InvalidArgumentException('El archivo no es un SVG válido.');
        }

        $this->clean($document->documentElement);

        return (string) $document->saveXML($document->documentElement);
    }

    private function clean(DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMElement) {
                if (! in_array(strtolower($child->localName), self::ELEMENTS, true)) {
                    $node->removeChild($child);

                    continue;
                }
                $this->cleanAttributes($child);
                $this->clean($child);
            } elseif ($child->nodeType === XML_PI_NODE || $child->nodeType === XML_COMMENT_NODE) {
                $node->removeChild($child);
            }
        }

        if ($node instanceof DOMElement) {
            $this->cleanAttributes($node);
        }
    }

    private function cleanAttributes(DOMElement $element): void
    {
        foreach (iterator_to_array($element->attributes) as $attribute) {
            $name = strtolower($attribute->nodeName);
            $value = trim((string) $attribute->nodeValue);

            $forbidden = ! in_array($name, self::ATTRIBUTES, true)
                || str_starts_with($name, 'on')
                // Solo referencias internas (#id); nada de URLs ni javascript:.
                || (in_array($name, ['href', 'xlink:href'], true) && ! str_starts_with($value, '#'))
                || preg_match('/url\s*\(\s*["\']?\s*(?!#)/i', $value)
                || preg_match('/javascript:|expression\s*\(|@import/i', $value);

            if ($forbidden) {
                $element->removeAttribute($attribute->nodeName);
            }
        }
    }
}
