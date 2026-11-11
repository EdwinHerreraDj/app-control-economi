<?php

/*
|--------------------------------------------------------------------------
| Monedas y formatos regionales
|--------------------------------------------------------------------------
|
| Catálogo de monedas que un usuario puede elegir como moneda principal
| (código ISO 4217) y número de decimales de su unidad menor, que se usará
| para guardar importes como enteros y redondear sin coma flotante.
|
| Ampliar la lista es seguro; quitar una moneda que ya usa alguien no.
|
*/

return [

    'currencies' => [
        'EUR' => ['name' => 'Euro', 'decimals' => 2],
        'USD' => ['name' => 'Dólar estadounidense', 'decimals' => 2],
        'COP' => ['name' => 'Peso colombiano', 'decimals' => 2],
        'MXN' => ['name' => 'Peso mexicano', 'decimals' => 2],
        'ARS' => ['name' => 'Peso argentino', 'decimals' => 2],
        'CLP' => ['name' => 'Peso chileno', 'decimals' => 0],
        'PEN' => ['name' => 'Sol peruano', 'decimals' => 2],
        'UYU' => ['name' => 'Peso uruguayo', 'decimals' => 2],
        'BOB' => ['name' => 'Boliviano', 'decimals' => 2],
        'PYG' => ['name' => 'Guaraní paraguayo', 'decimals' => 0],
        'VES' => ['name' => 'Bolívar venezolano', 'decimals' => 2],
        'DOP' => ['name' => 'Peso dominicano', 'decimals' => 2],
        'GTQ' => ['name' => 'Quetzal guatemalteco', 'decimals' => 2],
        'HNL' => ['name' => 'Lempira hondureño', 'decimals' => 2],
        'NIO' => ['name' => 'Córdoba nicaragüense', 'decimals' => 2],
        'CRC' => ['name' => 'Colón costarricense', 'decimals' => 2],
        'PAB' => ['name' => 'Balboa panameño', 'decimals' => 2],
        'CUP' => ['name' => 'Peso cubano', 'decimals' => 2],
        'BRL' => ['name' => 'Real brasileño', 'decimals' => 2],
        'GBP' => ['name' => 'Libra esterlina', 'decimals' => 2],
        'CHF' => ['name' => 'Franco suizo', 'decimals' => 2],
        'CAD' => ['name' => 'Dólar canadiense', 'decimals' => 2],
        'AUD' => ['name' => 'Dólar australiano', 'decimals' => 2],
        'JPY' => ['name' => 'Yen japonés', 'decimals' => 0],
        'CNY' => ['name' => 'Yuan chino', 'decimals' => 2],
        'SEK' => ['name' => 'Corona sueca', 'decimals' => 2],
        'NOK' => ['name' => 'Corona noruega', 'decimals' => 2],
        'DKK' => ['name' => 'Corona danesa', 'decimals' => 2],
        'PLN' => ['name' => 'Esloti polaco', 'decimals' => 2],
        'MAD' => ['name' => 'Dírham marroquí', 'decimals' => 2],
    ],

    /*
    | Formatos regionales para mostrar importes y fechas (etiqueta BCP 47).
    | Cada uno determina los separadores de miles y decimales.
    */
    'number_locales' => [
        'es-ES' => 'España',
        'es-MX' => 'México',
        'es-CO' => 'Colombia',
        'es-AR' => 'Argentina',
        'es-CL' => 'Chile',
        'es-PE' => 'Perú',
        'es-US' => 'Estados Unidos (español)',
        'en-US' => 'Estados Unidos (inglés)',
        'en-GB' => 'Reino Unido',
        'fr-FR' => 'Francia',
        'de-DE' => 'Alemania',
        'de-CH' => 'Suiza',
        'pt-BR' => 'Brasil',
    ],

    /* Idiomas de la interfaz disponibles. */
    'locales' => [
        'es' => 'Español',
    ],

];
