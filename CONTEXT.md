# Contexto del proyecto — Aplicación de economía personal

## 1. Propósito y estado actual

Construir una aplicación web para gestionar las cuentas personales: ingresos, gastos, deudas, presupuestos y ahorro. Ayudará a comprender la situación económica, anticipar falta de liquidez y tomar decisiones mediante análisis claros y una experiencia visual atractiva y amable.

Cada usuario tendrá un espacio privado con todas las funcionalidades financieras, como si dispusiera de su propia copia de la aplicación. Un superusuario gestionará los usuarios, la identidad visual global y el catálogo de mascotas.

Las nueve fases de la sección 16 están implementadas. Después se aplicó un rediseño «sencillo» (sección 6) para que cualquier persona, sin conocimientos financieros ni tecnológicos, pueda usar la aplicación sin tutoriales: funciona como una conversación cotidiana sobre el dinero, no como un programa de contabilidad. Las decisiones técnicas podrán ajustarse sin contradecir los requisitos del usuario.

## 2. Tecnologías y arquitectura

- Laravel en su última versión estable disponible al comenzar la implementación. La rama de referencia consultada en la conversación es Laravel 13; verificar la versión exacta antes de instalar.
- React con TypeScript e Inertia, partiendo del starter kit oficial compatible con Laravel.
- MySQL como base de datos.
- Tailwind CSS y componentes accesibles basados en shadcn/ui como propuesta inicial de interfaz.
- Vite para compilar los recursos.
- PWA mediante manifiesto, service worker y almacenamiento local con IndexedDB.
- Autenticación mediante las funcionalidades oficiales de Laravel, con sesiones persistentes y recuperación de contraseña por correo.

Se utilizará un único proyecto Laravel con React e Inertia. Laravel será la autoridad para permisos, validaciones y cálculos financieros. No se necesita una API pública independiente para la interfaz principal; se definirán endpoints autenticados específicos cuando la sincronización offline los requiera.

Las versiones de dependencias se comprobarán al iniciar el desarrollo y quedarán fijadas en los archivos de bloqueo. No utilizar versiones preliminares por defecto.

Referencias consultadas en la conversación:

- https://laravel.com/framework/docs/13.x/frontend
- https://github.com/laravel/docs/blob/13.x/starter-kits.md

## 3. Usuarios, roles y privacidad

### Superusuario

Podrá crear, editar, activar y suspender usuarios, enviar invitaciones o enlaces de recuperación, gestionar configuración global y consultar auditoría administrativa.

También podrá utilizar los módulos financieros con sus propios datos. El rol administrativo no dará acceso implícito a las finanzas de otros usuarios. No se incluirá suplantación de identidad inicialmente.

Se impedirá eliminar o suspender al último superusuario activo.

### Usuario

Dispondrá de todos los módulos financieros y podrá gestionar exclusivamente sus propios datos y preferencias (de la mascota, solo su visibilidad y animaciones). Su espacio inicial tendrá categorías orientativas, pero ningún movimiento financiero ficticio.

### Aislamiento

Se propone una base de datos compartida con propiedad explícita mediante `user_id` en las entidades personales. No se duplicará el código ni se creará inicialmente una base de datos por usuario.

El aislamiento se aplicará a consultas, relaciones, validaciones, autorizaciones, estadísticas, exportaciones, procesos en segundo plano y sincronización. No bastará con ocultar elementos de la interfaz: el servidor comprobará siempre la propiedad de cada recurso.

El almacenamiento local estará separado por usuario y no permitirá mostrar información de una cuenta a otra al cambiar de sesión.

## 4. Alta, autenticación y seguridad de acceso

El registro público estará deshabilitado inicialmente. El superusuario dará de alta a los usuarios con nombre y correo. Se enviará un enlace temporal para establecer contraseña, completar preferencias y entrar en la aplicación.

Como alternativa, el superusuario podrá crear la cuenta directamente con una contraseña temporal, sin enviar ningún correo. El correo sigue siendo obligatorio porque identifica a la persona al iniciar sesión. En el primer inicio de sesión será obligatorio sustituir la contraseña temporal por una propia, de modo que el administrador deje de conocerla. El superusuario también podrá poner una contraseña temporal a una cuenta existente cuando no pueda recuperarse por correo; esto cierra sus sesiones abiertas.

Se incluirán inicio y cierre de sesión, recuperación por correo, cambio de contraseña, limitación de intentos y revocación de acceso persistente por dispositivo.

Las contraseñas se almacenarán mediante hash; no se enviarán por correo ni se mostrarán al administrador. Los enlaces de activación y recuperación serán temporales y de un solo uso.

### Mantener la sesión

Se ofrecerá acceso persistente en dispositivos de confianza utilizando el mecanismo de recuerdo de Laravel y cookies seguras. El objetivo es que el usuario pueda volver a abrir la web o PWA sin autenticarse continuamente.

No se prometerá una sesión literalmente infinita: puede perderse por borrado de datos del navegador, revocación, cambio de contraseña o suspensión. Las operaciones sensibles podrán requerir confirmar la contraseña. El usuario podrá cerrar sesión y revocar otros dispositivos.

## 5. Configuración personal y moneda

Cada usuario gestionará su propia configuración, incluida la moneda; no dependerá de que el superusuario la cambie globalmente.

Preferencias previstas:

- Moneda principal, identificada mediante código ISO y presentada con formato local.
- Formato de importes y separadores decimales.
- Zona horaria e idioma; la interfaz inicial se desarrollará en español.
- Tema claro, oscuro o del sistema.
- Visibilidad y animaciones de la mascota (la mascota, su nombre y sus mensajes los decide el superusuario).
- Preferencia de acceso persistente y gestión de dispositivos.

La primera configuración solicitará la moneda, sin asumirla por el idioma o la ubicación.

### Cambios de moneda

Cambiar la moneda no significará sustituir el símbolo de los movimientos ya registrados. Cada registro monetario conservará su moneda original.

Para el MVP se propone una sola moneda operativa por espacio personal. Sin datos financieros se podrá cambiar libremente. Con datos existentes, la aplicación explicará la limitación y no permitirá reinterpretar importes ni crear totales con monedas mezcladas. La migración de un historial a otra moneda requerirá un flujo explícito con reglas de conversión; no se incluirá conversión automática inicialmente.

El selector permanecerá en la configuración del usuario y explicará estas condiciones antes de aplicar cambios.

## 6. Módulos financieros

### Experiencia sencilla y navegación

La interfaz usa expresiones naturales, cercanas y adultas, comprensibles en España y Latinoamérica: «Me entró dinero», «Gasté dinero», «¿Cuánto cobras?», «¿Qué pagas todos los meses?», «¿Debes dinero?», «¿Cuánto te falta?», «Ya lo pagué». No debe parecer un ERP, un banco ni una aplicación contable.

Navegación principal de cinco apartados: Inicio, Gastos, Ingresos, Mis pagos y Mis meses. En móvil la barra de apartados va arriba (abajo choca con los gestos de iPhone y Android) y un botón flotante «+», separado del borde y del área segura, sirve para apuntar; en escritorio, barra lateral con el botón «Apuntar». Las herramientas avanzadas (todos los movimientos, cuentas, categorías, estadísticas, presupuestos y metas de ahorro) siguen en «Más». En móvil los formularios se abren como un panel desde abajo, con los botones siempre visibles, que sube con el teclado para que siempre se vea lo que se escribe.

«Gastos» e «Ingresos» muestran todas las categorías con su icono: se toca una, se escribe el importe y listo. Debajo, lo del mes agrupado por categoría (de más a menos dinero); lo nuevo aparece en su grupo y lo pendiente se distingue en ámbar.

Colores con significado, siempre con texto o icono: verde lo que entra, rosa lo que sale, azul lo ahorrado, ámbar avisos y pendientes, y un índigo-violeta vivo como color principal.

### Primeros pasos

Tras elegir moneda y formato, un asistente hace cuatro preguntas, cada una omitible y completable después: ¿cuánto dinero tienes ahora? (banco y, opcionalmente, efectivo y ahorros aparte; es saldo inicial, no un ingreso), ¿cuánto cobras normalmente? (fijo, variable o sin ingresos fijos; frecuencia y día), ¿qué cosas pagas habitualmente? (alquiler, luz, internet…, con importe fijo o variable y día) y ¿tienes alguna deuda o compra a cuotas? (qué es, total, cuota, frecuencia, cuotas ya pagadas y próxima fecha). Termina con un resumen de la situación. A quien ya tiene cuentas no se le vuelve a pedir.

### Inicio («Mi dinero»)

Responde a cinco preguntas: cuánto tengo para gastar (y, aparte, cuánto tengo ahorrado), cuánto me ha entrado y cuánto he gastado este mes, qué me toca pagar pronto (con «Ya lo pagué» y «Ya lo cobré») y cuánto debo todavía. Importes grandes, fechas claras y explicaciones breves, sin gráficos innecesarios.

Se separan siempre el dinero disponible, lo que se espera recibir, los pagos pendientes, las deudas y lo que podría quedar a final de mes. Esa última cifra es una estimación etiquetada como tal: un cobro o pago previsto nunca se suma ni se resta del dinero disponible hasta confirmarlo. Se distinguen también los datos pendientes de sincronizar.

### Apuntar en segundos

«Gasté dinero» y «Me entró dinero» piden solo cuánto, en qué o de dónde, y cuándo (hoy por defecto). La categoría se sugiere a partir del texto y del historial de la persona, y siempre se puede cambiar. En los gastos se puede indicar opcionalmente si fue algo necesario, un gusto, un pago habitual u otro. Si lo apuntado coincide con un cobro o pago pendiente, se ofrece confirmar ese en lugar de crear otro, para no duplicarlo. Un gasto común debe poder apuntarse en menos de 15 segundos.

«Mis ahorros» mueve dinero entre la cuenta de ahorro y las demás: es una transferencia, no un gasto.

### Mis pagos

Tres pestañas: lo que toca pagar y cobrar en los próximos 30 días (incluido lo atrasado), los pagos y cobros de cada mes, y «Lo que debo». «Ya lo pagué» registra el importe, la fecha y la cuenta reales (los pagos variables pueden costar distinto cada vez) y la siguiente fecha aparece sola. «Este no» omite un pago concreto sin que vuelva a generarse.

### Mis meses

Para cada mes: lo recibido, lo gastado (pagos habituales, gustos y resto), las cuotas de deudas, el resultado y los movimientos agrupados por día. Cada movimiento cuenta en el mes de su fecha real aunque se apunte después, y una sola vez.

### Avisos

Como mucho tres a la vez, con datos reales y sin juzgar los hábitos: «Mañana te toca pagar el alquiler», «Tienes un pago pendiente desde ayer», «Te quedan 3 cuotas del portátil», «Este mes llevas 75 € en restaurantes», «Este mes te han entrado 120 € más de lo habitual».

### Cuentas

Gestión de cuentas bancarias, efectivo y otros depósitos: nombre, tipo, moneda, saldo inicial y estado activo o archivado.

Las transferencias entre cuentas propias afectarán al saldo de ambas, pero no se considerarán ingresos ni gastos. No se archivarán cuentas de forma que se pierda el historial.

Una cuenta de ahorro (donde la persona va guardando dinero) se muestra aparte: no cuenta como dinero para gastar, pero sí como dinero suyo.

### Ingresos

Registro de importe, fecha, cuenta de destino, categoría, concepto, notas y recurrencia opcional. Se diferenciarán ingresos previstos y recibidos.

### Gastos

Registro de importe, fecha, cuenta de origen, categoría, concepto, notas, condición de fijo o variable, recurrencia, vencimiento y estado previsto o pagado.

Habrá búsqueda, filtros, edición y anulación con trazabilidad. Un movimiento previsto no modificará el saldo real hasta confirmarse.

### Categorías

Categorías iniciales editables y categorías propias, con nombre, icono y color. Se podrán archivar conservando el historial.

### Deudas

El alcance inicial cubrirá el dinero que el usuario debe: acreedor, concepto, capital inicial y pendiente, fecha de inicio, cuota, periodicidad, vencimientos, intereses, comisiones e historial de pagos.

Los pagos distinguirán capital, intereses y comisiones. Se admitirán pagos parciales y liquidación anticipada con actualización coherente del pendiente.

Recibir un préstamo aumentará saldo y deuda, sin contarse como ingreso ordinario. Devolver capital reducirá saldo y deuda; los intereses y comisiones serán gastos. Los pagos no se duplicarán por aparecer en el historial de deuda y en una cuenta.

Los calendarios de amortización avanzados y productos con condiciones complejas se definirán aparte; no se inventarán intereses que el usuario no haya registrado o configurado.

Al apuntar una deuda puede indicarse lo ya pagado antes de usar la aplicación: reduce lo pendiente sin mover dinero. Se admiten deudas sin cuotas (un préstamo entre amigos). «Lo que debo» muestra lo que se debía, lo pagado, lo que falta, la próxima cuota y la fecha estimada de fin; «Pagué una cuota» admite pagos parciales, anticipados y con intereses opcionales, y el pendiente nunca es negativo.

### Presupuestos y objetivos de ahorro

Presupuestos por período y categoría, comparación entre previsto y realizado, objetivos de ahorro, aportaciones y progreso.

Reservar dinero para un objetivo no generará por sí solo un movimiento bancario. Se distinguirán las reservas presupuestarias, las aportaciones y las transferencias reales.

### Recurrencias y vencimientos

Ingresos, gastos y cuotas recurrentes permitirán anticipar compromisos. Se definirán fecha de inicio, frecuencia, próxima ocurrencia y finalización opcional.

Generar una previsión no implicará darla por cobrada o pagada. La generación será idempotente para evitar duplicados al repetir procesos.

### Análisis y estadísticas

- Evolución de ingresos y gastos.
- Distribución por categorías.
- Comparación entre períodos equivalentes.
- Evolución del capital pendiente.
- Cumplimiento de presupuestos y objetivos.
- Previsión de liquidez y margen estimado de ahorro.

Los gráficos tendrán resumen textual y acceso a los importes. Las estimaciones explicarán el período, datos y supuestos utilizados; si falta información, se indicará.

## 7. Reglas financieras

- Importes con precisión decimal o unidades menores enteras y reglas explícitas de redondeo; no utilizar coma flotante para operaciones monetarias.
- Saldo real: saldo inicial más movimientos confirmados.
- Saldo proyectado: saldo real más cobros previstos menos pagos previstos en el horizonte seleccionado.
- Ahorro estimado: margen disponible tras obligaciones y reservas, sin descontar dos veces un mismo compromiso.
- Transferencias propias excluidas de ingresos y gastos.
- Capital de deuda separado de intereses y comisiones.
- Movimientos vinculados guardados mediante transacciones de base de datos.
- Anulaciones, devoluciones y modificaciones mantendrán saldos e historial coherentes.
- El servidor recalculará y validará operaciones procedentes del modo offline.

No se concluirá que una persona puede ahorrar solo porque sus ingresos superen los gastos del mes: se considerarán saldo, vencimientos y liquidez. Las previsiones serán orientativas y no garantizarán resultados.

## 8. Diseño y comunicación

Interfaz llamativa, moderna y fácil de entender, diseñada primero para móvil: tarjetas claras, tipografía legible, espacios amplios, acciones rápidas y navegación sencilla. Los detalles visuales no deben dificultar la lectura de importes.

Se propone una base cromática tranquila con acentos atractivos, temas claro y oscuro y animaciones discretas. El rojo se reservará para errores o avisos concretos; un saldo negativo no convertirá todo el panel en una alarma.

Se comunicarán las dificultades con precisión, sin ocultarlas ni culpabilizar. Ejemplo: “Con los movimientos registrados, se prevé que falten 85 € para cubrir los pagos de este mes. Puedes revisar los próximos vencimientos”.

No habrá mensajes humillantes, presión por abrir la app ni afirmaciones de ahorro sin datos. Los estados utilizarán texto e iconos además de color.

Objetivo de accesibilidad: WCAG 2.2 AA, incluyendo teclado, foco visible, contraste, etiquetas, alternativas textuales y reducción de movimiento.

## 9. Mascota financiera virtual

### Propósito

Cada usuario contará con una mascota, elegida por el superusuario y con inspiración en un Tamagotchi, que acompañe la consulta de las cuentas y represente su evolución mediante gestos y mensajes.

No será un mecanismo de castigo: no enfermará, morirá ni sufrirá por tener deudas, déficit o por no entrar en la app. No requerirá alimentación ni tareas de cuidado obligatorias.

No se necesita un motor de videojuegos. React mostrará recursos gráficos según el estado calculado por Laravel.

### Preferencias del usuario

La mascota, su nombre y sus mensajes los decide únicamente el superusuario: todas las personas ven la mascota predeterminada. Cada usuario solo puede ajustar lo relativo a su accesibilidad y comodidad: mostrarla, minimizarla u ocultarla, y reducir o desactivar sus animaciones. No habrá sonidos automáticos ni interrupciones repetitivas.

Se podrán celebrar hábitos como revisar el presupuesto o alcanzar una meta, sin comparar personas por su riqueza.

### Estados iniciales

| Estado | Representación | Condición orientativa |
|---|---|---|
| Reposo | Respirar o parpadear suavemente | Estado habitual |
| Bienvenida | Saludar | Entrada del usuario, de forma breve |
| Celebración | Gesto alegre o salto | Meta o hito confirmado |
| Atención | Gesto atento y curioso | Margen proyectado reducido |
| Acompañamiento | Expresión cercana y tranquila | Déficit o dificultad prevista |
| Sin información | Esperar o pensar | Datos insuficientes o desactualizados |

Los estados financieros y las animaciones transitorias se distinguirán: una bienvenida o celebración no sustituirá el resumen real de las cuentas.

El motor de estados compartirá los cálculos del panel. Considerará liquidez proyectada, vencimientos, presupuestos y calidad de datos, con reglas documentadas y umbrales configurables técnicamente. Tener una deuda no implicará por sí solo un estado desfavorable.

El servidor proporcionará estado, motivo y mensaje. Si no hay información suficiente, prevalecerá un estado neutral. Los mensajes no se presentarán como certezas cuando sean proyecciones.

### Recursos visuales

Cada mascota será el mismo personaje en distintos estados, conservando proporción, estilo, encuadre y posición para evitar saltos visuales.

La propuesta inicial es utilizar imágenes PNG o WebP transparentes de 512 × 512 px y, opcionalmente, WebP animado con alternativa estática. GIF podrá evaluarse por compatibilidad, pero no será el formato principal previsto. No se requieren modelos 3D, archivos ejecutables ni integración con el sistema de mascotas de otras aplicaciones.

Se podrá publicar una mascota con imágenes estáticas e incorporar animaciones después. Reposo e imagen de presentación serán obligatorios; estados sin recurso propio utilizarán reposo como alternativa.

Las celebraciones serán breves. Las animaciones en bucle serán suaves, se pausarán cuando no sean visibles y respetarán la reducción de movimiento.

### Gestión por el superusuario

Apartado Configuración → Mascotas con:

- Nombre, descripción e imagen de presentación.
- Recursos por estado y alternativas estáticas.
- Vista previa de estados, transiciones y mensajes.
- Publicación, archivo y mascota predeterminada.
- Indicador de recursos faltantes y dimensiones recomendadas.
- Mensajes por situación mediante plantillas y variables permitidas.

La mascota predeterminada es la que ven todas las personas; para cambiarla se marca otra publicada como predeterminada. Archivar retira una mascota del catálogo conservando sus recursos; la predeterminada no se puede archivar.

Los recursos subidos se guardarán en almacenamiento persistente de la aplicación o almacenamiento de objetos, con referencias en MySQL y versiones para la caché. Git gestionará el código y, en su caso, recursos iniciales incluidos en el proyecto; las subidas administrativas no necesitarán commits ni despliegues.

Se validarán contenido real, dimensiones, peso y duración de archivos animados. Los límites concretos se definirán y mostrarán en el panel durante la implementación. No se admitirán scripts ni formatos arbitrarios ejecutables.

Se comenzará con una mascota completa para validar la experiencia y luego ampliar el catálogo. La producción de ilustraciones o animaciones será una tarea posterior; no se generan en esta etapa documental.

## 10. PWA y funcionamiento sin conexión

La PWA es un requisito principal: instalación, experiencia independiente, recursos adaptados y modo offline, dentro de las capacidades de cada navegador y sistema operativo.

### Instalación y actualización

HTTPS en producción, manifiesto con nombre y nombre corto, iconos, colores, modo standalone, service worker y guía de instalación adaptada. Las actualizaciones tendrán aviso y activación controlada para no interrumpir formularios ni perder cambios.

### Alcance offline

Tras una primera autenticación y sincronización se podrá abrir la app, consultar datos ya sincronizados y registrar ingresos o gastos pendientes. Se mostrarán conexión, última sincronización y estado de cada operación.

La recuperación de contraseña, la administración y la configuración global requerirán conexión. El alcance offline de edición de deudas y otras operaciones complejas se evaluará después; no se asumirá sin definir sus conflictos.

Los recursos de la mascota elegida estarán disponibles localmente. Sus mensajes indicarán cuando se basen en datos antiguos o movimientos pendientes.

### Sincronización

Las operaciones tendrán identificadores únicos para evitar duplicados. Al recuperar conexión se validará la sesión, enviarán cambios, comprobarán permisos y descargarán los datos confirmados.

Habrá control de versiones y resolución explícita de conflictos; no se sobrescribirán cambios financieros silenciosamente. La sincronización funcionará al abrir la app, al recuperar conexión con la app activa y mediante acción manual, sin depender exclusivamente de Background Sync.

### Privacidad

No se almacenarán indiscriminadamente respuestas financieras en la caché del service worker. El almacenamiento local estará separado por usuario y se limpiará al cerrar sesión. Si hay cambios pendientes, se avisará antes de descartarlos.

Una suspensión o revocación se aplicará al reconectar; no puede retirar inmediatamente información ya almacenada en un dispositivo desconectado.

Los saldos y deudas no se enviarán en notificaciones externas sin consentimiento explícito. Las notificaciones push no forman parte obligatoria del MVP.

## 11. Identidad visual global

El superusuario podrá configurar nombre y nombre corto, logotipo principal, variante para fondos oscuros, favicon, iconos PWA, colores y vista previa.

Cada campo mostrará formatos admitidos, peso máximo, dimensiones recomendadas y requisitos de transparencia.

| Recurso | Recomendación inicial |
|---|---|
| Logo horizontal | SVG saneado o PNG; referencia 1200 × 400 px |
| Logo cuadrado | PNG de 512 × 512 px |
| Favicon | ICO con 16, 32 y 48 px; SVG opcional saneado |
| Icono PWA estándar | PNG de 192 × 192 y 512 × 512 px |
| Icono PWA maskable | PNG de 512 × 512 px con fondo opaco |
| Apple touch icon | PNG de 180 × 180 px |
| Original para generar variantes | PNG cuadrado de 1024 × 1024 px o superior |

Para maskable, el contenido esencial se mantendrá dentro del círculo central de seguridad de diámetro equivalente al 80 % del lienzo.

Se propone generar variantes desde un original adecuado, permitiendo sustituirlas individualmente. Se validarán los archivos y sanearán los SVG. Los recursos se versionarán para actualizar cachés; algunos sistemas pueden tardar en renovar el icono de una PWA ya instalada.

## 12. Comando de creación del superusuario

Se implementará el comando Artisan:

```bash
php artisan app:create-superuser
```

El comando todavía no existe. Solicitará nombre, correo, contraseña oculta y confirmación. Validará datos, evitará duplicados y creará usuario y rol de forma atómica.

No habrá credenciales predeterminadas ni contraseñas como argumentos visibles en el historial de terminal. Promover una cuenta existente requerirá una acción explícita, sin modificarla silenciosamente.

## 13. Modelo de datos orientativo

| Entidad | Responsabilidad |
|---|---|
| users | Identidad, rol, estado y preferencias personales |
| accounts | Cuentas, moneda y saldo inicial |
| categories | Categorías personales |
| transactions | Movimientos previstos o confirmados |
| transfers | Vinculación de movimientos entre cuentas propias |
| recurring_rules | Reglas y ocurrencias recurrentes |
| debts | Capital, condiciones y vencimientos |
| debt_payments | Desglose de pagos |
| budgets | Límites por período y categoría |
| savings_goals | Objetivos personales |
| savings_contributions | Aportaciones a objetivos |
| app_settings | Configuración global |
| media_assets | Recursos visuales almacenados y versiones |
| mascots | Catálogo y estado de publicación |
| mascot_assets | Recursos de cada mascota por estado |
| mascot_messages | Plantillas y condiciones de mensajes |
| audit_logs | Acciones sensibles y administrativas |
| sync_operations | Idempotencia y seguimiento de sincronización |
| invitation_tokens | Enlaces de invitación, separados de la recuperación de contraseña |

Rediseño sencillo (migración aditiva): lo ya pagado de una deuda antes de usar la aplicación (`debts.paid_before`), a quién se debe pasa a ser opcional, clasificación opcional del gasto (`transactions.spending_type`: necesario, gusto, habitual u otro) y fecha de la primera configuración (`users.setup_completed_at`).

Se añadirán las tablas oficiales necesarias para sesiones, recuperación de contraseña y colas. Las preferencias de mascota podrán residir en usuarios o en una entidad propia según su complejidad.

Las entidades personales tendrán propietario, índices y restricciones coherentes. La estructura definitiva se concretará con migraciones al comenzar el desarrollo.

## 14. Organización del código

Controladores para coordinar peticiones, Form Requests para validar, Policies para autorizar, acciones o servicios para operaciones financieras y consultas específicas para análisis.

Jobs para correos y tareas diferidas; scheduler para recurrencias. Frontend con componentes compartidos y módulos para finanzas, configuración, mascota y almacenamiento local.

No se dispersarán fórmulas financieras entre componentes React. Los cálculos offline serán provisionales y el servidor los verificará al sincronizar.

## 15. Despliegue y operación

Se necesitarán PHP y extensiones compatibles, MySQL, servidor HTTPS, correo transaccional, worker de colas, scheduler y almacenamiento persistente para recursos subidos.

El procedimiento de despliegue incluirá variables de entorno fuera del repositorio, instalación de dependencias, compilación, migraciones, cachés de producción y creación del primer superusuario.

Se configurarán copias de seguridad de base de datos y archivos, con prueba de restauración. Los registros operativos no expondrán contraseñas, tokens ni detalles financieros innecesarios.

## 16. Fases propuestas

1. Verificar versiones estables y crear la base Laravel, React, Inertia y MySQL.
2. Implementar autenticación, roles, altas, aislamiento y comando de superusuario.
3. Crear configuración personal, moneda y estructura visual accesible.
4. Implementar cuentas, categorías, ingresos, gastos y transferencias.
5. Incorporar deudas, recurrencias, presupuestos y objetivos.
6. Desarrollar panel, estadísticas y previsiones explicables.
7. Crear configuración de identidad y catálogo de mascotas; integrar una mascota inicial.
8. Completar instalación PWA, modo offline, sincronización y actualización.
9. Validar seguridad, cálculos, accesibilidad y despliegue; documentar operación.
10. Rediseño sencillo: primeros pasos, Inicio, Gastos, Ingresos, Mis pagos, Mis meses, apuntes rápidos y navegación en cinco apartados.

El diseño de identificadores, conflictos, privacidad local y sincronización se realizará desde la base del proyecto, aunque la fase offline se complete después.

## 17. Validación y criterios de aceptación

- Un usuario no puede leer ni modificar datos ajenos, incluso alterando identificadores.
- El superusuario administra usuarios y configuración sin acceso implícito a movimientos ajenos.
- Existe un comando funcional para crear el primer superusuario.
- Alta y recuperación de contraseña funcionan con correo real en producción.
- El acceso persistente funciona en dispositivos de confianza y puede revocarse.
- Cada usuario gestiona su moneda y nunca se reinterpretan importes históricos silenciosamente.
- Saldos, transferencias, pagos parciales y deudas mantienen integridad y no duplican estadísticas.
- Las previsiones explican supuestos y muestran falta de datos.
- Una situación económica desfavorable se comunica con exactitud y moderación.
- La interfaz funciona en móvil, tableta y escritorio y permite navegación accesible.
- La PWA se instala donde exista soporte y permite el alcance offline definido.
- La sincronización evita duplicados, valida permisos y hace visibles los conflictos.
- Cerrar sesión evita exponer los datos locales a otra cuenta.
- El superusuario puede subir identidad e iconos con validación, ayuda de medidas y vista previa.
- Puede publicar una mascota estática y añadir animaciones sin cambios de código.
- El superusuario decide la mascota, su nombre y sus mensajes; el usuario puede ocultarla, minimizarla o reducir su animación.
- Los estados de la mascota son coherentes con el panel y nunca castigan la dificultad económica.
- Los recursos faltantes tienen alternativa estática y funcionan sin conexión tras descargarse.
- Se prueban los flujos críticos con pruebas de integración y navegador según corresponda.
- Se verifica restauración de una copia de seguridad.
- Una persona que solo quiere apuntar que cobró 1.400 €, pagó 450 € de alquiler, se tomó una cerveza de 4 € y debe 300 € de un portátil puede hacerlo sin explicaciones y entiende cuánto dinero tiene, cuánto ha gastado y qué pagos le quedan.
- Un gasto común se apunta en menos de 15 segundos.

## 18. Límites iniciales y decisiones pendientes

No se incluyen inicialmente conexiones bancarias automáticas, pagos reales, inversiones, declaraciones fiscales, espacios familiares compartidos, conversión automática de monedas ni préstamos concedidos a terceros.

Quedan por elegir antes de sus fases: nombre comercial, estilo visual definitivo, moneda inicial de cada usuario, personaje de la primera mascota, recursos gráficos, alojamiento, proveedor de correo y política concreta de conservación y eliminación de cuentas.

La ausencia de estas elecciones no impide comenzar la base técnica. No se instalará ni desarrollará nada como consecuencia de crear este documento.
