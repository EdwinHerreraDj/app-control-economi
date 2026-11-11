<?php

/*
|--------------------------------------------------------------------------
| Catálogo visual de categorías y categorías iniciales
|--------------------------------------------------------------------------
|
| Los iconos son nombres de Lucide (en kebab-case) que la interfaz sabe
| dibujar. Los colores son nombres de una paleta sin rojo: el rojo se
| reserva para errores y avisos.
|
*/

return [

    // Días por delante para los que se generan previsiones recurrentes.
    'recurring_horizon_days' => 62,

    // Días por delante que se muestran en «Próximos vencimientos».
    'upcoming_days' => 45,

    // Porcentaje de un presupuesto a partir del cual se avisa con calma.
    'budget_warning_percent' => 80,

    // «Margen reducido»: el saldo más bajo previsto queda por debajo de
    // este porcentaje del saldo actual (lo usan el panel y la mascota).
    'attention_margin_percent' => 10,

    // Días de la previsión de liquidez del panel.
    'forecast_days' => 30,

    'icons' => [
        'briefcase', 'laptop', 'tag', 'rotate-ccw', 'circle-plus', 'house',
        'zap', 'shopping-cart', 'utensils', 'coffee', 'car', 'bus', 'plane',
        'heart-pulse', 'graduation-cap', 'party-popper', 'shirt', 'smartphone',
        'shield', 'landmark', 'percent', 'gift', 'baby', 'dog', 'dumbbell',
        'wrench', 'piggy-bank', 'wallet', 'book-open', 'circle-ellipsis',
    ],

    'colors' => [
        'teal', 'emerald', 'lime', 'amber', 'orange', 'pink', 'violet',
        'indigo', 'sky', 'slate',
    ],

    // Se crean al terminar la primera configuración. Son editables y
    // archivables; no se crea ningún movimiento ficticio.
    'default_categories' => [
        'income' => [
            ['Nómina', 'briefcase', 'emerald'],
            ['Trabajo por cuenta propia', 'laptop', 'teal'],
            ['Ventas', 'tag', 'sky'],
            ['Reembolsos y devoluciones', 'rotate-ccw', 'indigo'],
            ['Otros ingresos', 'circle-plus', 'slate'],
        ],
        'expense' => [
            ['Vivienda', 'house', 'amber'],
            ['Suministros', 'zap', 'orange'],
            ['Alimentación', 'shopping-cart', 'lime'],
            ['Restaurantes', 'utensils', 'orange'],
            ['Transporte', 'car', 'sky'],
            ['Salud', 'heart-pulse', 'pink'],
            ['Educación', 'graduation-cap', 'indigo'],
            ['Ocio', 'party-popper', 'violet'],
            ['Ropa', 'shirt', 'pink'],
            ['Comunicaciones', 'smartphone', 'teal'],
            ['Seguros', 'shield', 'slate'],
            ['Impuestos y tasas', 'landmark', 'slate'],
            ['Comisiones e intereses', 'percent', 'amber'],
            ['Regalos y donaciones', 'gift', 'violet'],
            ['Otros gastos', 'circle-ellipsis', 'slate'],
        ],
    ],

];
