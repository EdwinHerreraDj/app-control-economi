# Operación y mantenimiento

Tareas habituales para mantener Economía Personal en producción.

## 1. Copias de seguridad

### Qué se copia

`php artisan app:backup` crea una carpeta `AAAAMMDD-HHMMSS` dentro de `BACKUP_PATH` con:

- `database.sql.gz`: la base de datos completa (copia coherente, sin bloquear la app).
- `media.zip`: los archivos subidos (logotipos, iconos, imágenes de mascotas).
- `manifest.json`: recuentos de filas por tabla y huellas SHA-256 de los archivos.

Se ejecuta cada día a las 03:00 y borra las copias de más de `BACKUP_KEEP_DAYS` días, conservando siempre las tres más recientes.

Las credenciales de la base de datos nunca aparecen en la línea de órdenes: se pasan en un archivo temporal que solo puede leer el usuario del sistema.

Funciona con MySQL 8+ y con MariaDB 10.6+. El motor se detecta por la versión del servidor y se usan sus propios programas: `mysqldump`/`mysql` o `mariadb-dump`/`mariadb`. Si no están en el `PATH`, indica la ruta completa en `BACKUP_MYSQLDUMP` y `BACKUP_MYSQL`.

### Fuera del servidor

Las copias contienen datos financieros personales. Llévalas también a otro sitio, **cifradas**. Por ejemplo, con `restic` o `rclone crypt` desde el cron, después de las 03:00:

```cron
30 3 * * * www-data restic -r s3:... backup /var/backups/economia
```

Guarda aparte, también fuera del servidor, el archivo `.env` (en especial `APP_KEY`).

### Prueba de restauración

`php artisan app:backup:verify` (cada domingo a las 04:30, o a mano cuando quieras):

1. Comprueba las huellas de los archivos.
2. Carga la copia en una base de datos temporal (`<base>_restore_check`).
3. Compara cada tabla con los recuentos del manifiesto.
4. Comprueba que `media.zip` está íntegro y completo.
5. Borra la base de datos temporal.

Para verificar una copia concreta: `php artisan app:backup:verify 20261111-030000`.

Si falla, el registro (`storage/logs`) lo indica y el comando termina con error. Revísalo enseguida: una copia que no se restaura no sirve.

### Restaurar de verdad

Solo ante una pérdida real de datos:

```bash
cd /var/www/economia
php artisan down
php artisan app:backup                      # copia del estado actual, por si acaso

COPIA=/var/backups/economia/20261111-030000

# Cliente del mismo motor que el servidor: «mariadb» con MariaDB, «mysql» con MySQL
# (los volcados de MariaDB 11 empiezan con una línea que el cliente de MySQL no entiende).
CLIENTE=mariadb

# Base de datos (vacía antes la actual o restaura en una nueva)
$CLIENTE -u economia -p -e "DROP DATABASE personal_economi; CREATE DATABASE personal_economi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
gunzip -c "$COPIA/database.sql.gz" | $CLIENTE -u economia -p personal_economi

# Archivos subidos
rm -rf storage/app/public/* && unzip -o "$COPIA/media.zip" -d storage/app/public

php artisan migrate --force                 # por si la copia es de una versión anterior
php artisan optimize:clear && php artisan optimize
php artisan app:check-integrity
php artisan up
```

Usa el mismo `APP_KEY` que tenía la instalación original.

Tras una restauración, los dispositivos que tenían movimientos sin enviar los enviarán al reconectar. El servidor ignora los que ya existen y marca como posible duplicado lo que parezca repetido, para que la persona decida.

## 2. Coherencia de los datos

`php artisan app:check-integrity` comprueba, solo leyendo:

- Que cada movimiento pertenece al dueño de su cuenta y tiene su misma moneda.
- Que las categorías son del mismo usuario y del tipo correcto.
- Que cada transferencia tiene exactamente su salida y su entrada, con el mismo importe y estado.
- Que cada pago de deuda cuadra con sus movimientos (capital, intereses y comisiones).
- Que las aportaciones y recurrencias pertenecen a su usuario.

Se ejecuta cada domingo. El informe solo contiene identificadores (nunca importes ni conceptos). Si encuentra incidencias, aparecen en el registro como aviso; investígalas con esos identificadores antes de corregir nada a mano.

## 3. Usuarios y seguridad

- **Altas:** por invitación (enlace de un solo uso, caduca a las 72 h) o con contraseña temporal que la persona cambia al entrar.
- **Suspender** una cuenta cierra todas sus sesiones al momento. Sus datos en dispositivos sin conexión se borran cuando ese dispositivo vuelve a conectarse.
- **Contraseña temporal o cambio de correo hechos por el superusuario:** la persona recibe siempre un aviso por correo (el del cambio de correo, en su dirección anterior) y queda constancia en la auditoría.
    - Es la única forma en que un superusuario podría llegar a entrar en una cuenta ajena, y nunca pasa desapercibida.
    - Úsalo solo cuando la persona lo pida.
- **Recuperación de contraseña:** responde lo mismo exista o no la cuenta y está limitada por IP y por correo, para no revelar qué direcciones están registradas.
- **Auditoría** (Administración → Auditoría): altas, cambios de rol y estado, contraseñas temporales, identidad visual y mascotas. No guarda contraseñas ni datos financieros.

## 4. Registros

- Aplicación: `storage/logs/laravel.log`, que no contiene contraseñas, tokens ni importes.
- Revisa periódicamente los avisos de `app:backup`, `app:backup:verify` y `app:check-integrity`.
- Comprobación de salud para monitorización externa: `GET /up` responde 200 si la app arranca.

## 5. App instalable y modo sin conexión

- El _service worker_ (`/sw.js`) solo guarda código, estilos, iconos y la página sin conexión; nunca respuestas con datos financieros.
- Los datos para usar la app sin conexión viven en el navegador de cada persona (IndexedDB), separados por usuario, y se borran al cerrar sesión.
- Problemas frecuentes:
    - **No aparece «Instalar»:** el sitio no va por HTTPS, o el navegador no lo admite (Firefox en escritorio). En iPhone se instala desde Safari → Compartir → Añadir a pantalla de inicio.
    - **Una persona no ve los cambios de una versión nueva:** debe pulsar «Actualizar» en el aviso, o cerrar y volver a abrir la app.
    - **Movimientos «por revisar»:** el servidor los rechazó (por ejemplo, la cuenta se archivó) o parecen duplicados. La persona los corrige o descarta en Configuración → Dispositivo.

## 6. Comandos de referencia

| Comando                                        | Para qué                                      |
| ---------------------------------------------- | --------------------------------------------- |
| `php artisan app:create-superuser [--promote]` | Crear o promover un superusuario              |
| `php artisan app:mail-test <correo>`           | Probar el envío de correo                     |
| `php artisan app:backup`                       | Copia de seguridad                            |
| `php artisan app:backup:verify [copia]`        | Prueba de restauración                        |
| `php artisan app:check-integrity`              | Coherencia de los datos financieros           |
| `php artisan app:generate-recurring`           | Generar previsiones recurrentes (idempotente) |
| `php artisan app:generate-default-icons`       | Regenerar los iconos por defecto              |
| `php artisan schedule:list`                    | Ver las tareas programadas                    |
