# Economía Personal

Aplicación web instalable (PWA) para gestionar las finanzas personales: cuentas, ingresos y gastos, transferencias, deudas, recurrencias, presupuestos, objetivos de ahorro, estadísticas y previsiones explicables. Incluye una mascota que acompaña sin juzgar y un modo sin conexión con sincronización.

Cada persona solo ve y gestiona sus propios datos. El superusuario administra usuarios, identidad visual y mascotas, pero no las finanzas de nadie.

El documento de requisitos completo está en [CONTEXT.md](CONTEXT.md).

## Tecnología

- Laravel 13 (PHP 8.3+), Fortify, MySQL.
- React 19 + TypeScript con Inertia 3, Tailwind 4 y componentes shadcn.
- PWA: service worker propio, IndexedDB para el modo sin conexión.
- Pruebas con Pest; análisis estático con Larastan (nivel 7) y Pint.

## Puesta en marcha en local

```bash
composer setup                  # dependencias, .env, clave, migraciones y compilación
php artisan db:seed             # mascotas e identidad por defecto
php artisan app:create-superuser
composer dev                    # servidor, cola y Vite
```

Configura la conexión de MySQL en `.env` antes de migrar.

Con `composer dev` la interfaz se sirve desde Vite y **el modo sin conexión no se activa** (el service worker solo se registra con la compilación). Para probarlo, ejecuta `npm run build` y abre la app sin el servidor de Vite.

## Calidad

```bash
php artisan test        # pruebas
vendor/bin/phpstan      # análisis estático
vendor/bin/pint         # estilo PHP
npm run check           # lint y formato del frontend
npm run types:check     # TypeScript
```

## Documentación

- [Despliegue en producción](docs/despliegue.md)
- [Operación y mantenimiento](docs/operacion.md): copias de seguridad y restauración, coherencia de los datos, usuarios y seguridad.
