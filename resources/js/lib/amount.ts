/**
 * Convierte lo que escribe el usuario en un importe decimal con punto
 * («1.234,56» en es-ES → «1234.56»), que es lo que espera el servidor.
 *
 * El servidor vuelve a validar el resultado; esto solo interpreta los
 * separadores habituales del formato regional elegido.
 */
export function separatorsFor(locale: string): {
    group: string;
    decimal: string;
} {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);

    return {
        group: parts.find((part) => part.type === 'group')?.value ?? ',',
        decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    };
}

export function normalizeAmount(raw: string, locale: string): string {
    const { group, decimal } = separatorsFor(locale);
    // Espacios normales, duros y finos, y apóstrofos (separadores de miles).
    let value = raw.trim().replace(/[\s  '’]/g, '');

    if (value === '') {
        return '';
    }

    const negative = value.startsWith('-');
    value = value.replace(/^[-+]/, '');

    const groupSymbol = group.trim() === '' ? null : group;

    if (
        groupSymbol &&
        value.includes(groupSymbol) &&
        !value.includes(decimal)
    ) {
        // Solo aparece el separador de miles: si va seguido de 1 o 2 cifras
        // al final, casi seguro que la persona quiso escribir decimales
        // («12.50» en es-ES).
        const lastGroup = value.lastIndexOf(groupSymbol);
        const tail = value.length - lastGroup - 1;
        const occurrences = value.split(groupSymbol).length - 1;

        if (occurrences === 1 && tail > 0 && tail <= 2) {
            value = value.replace(groupSymbol, '.');

            return (negative ? '-' : '') + value;
        }
    }

    if (groupSymbol) {
        value = value.split(groupSymbol).join('');
    }

    value = value.replace(decimal, '.');

    return (negative ? '-' : '') + value;
}

/** Texto inicial de un campo de importe a partir del decimal del servidor. */
export function amountForInput(decimalValue: string, locale: string): string {
    const { decimal } = separatorsFor(locale);

    return decimalValue.replace('.', decimal);
}
