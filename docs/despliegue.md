# Despliegue en producción

Guía para instalar y actualizar Economía Personal en un servidor propio.

## 1. Requisitos

| Componente       | Versión / notas                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| PHP              | 8.3 o superior, con `bcmath`, `ctype`, `curl`, `fileinfo`, `gd`, `intl`, `mbstring`, `openssl`, `pdo_mysql`, `tokenizer`, `xml`, `zip`, `zlib` |
| Base de datos    | MySQL 8 o superior (o MariaDB 10.6+), juego de caracteres `utf8mb4`                                                                            |
| Cliente de la BD | Copias de seguridad: `mysqldump` y `mysql` (MySQL) o `mariadb-dump` y `mariadb` (MariaDB). Se eligen solos según el motor del servidor         |
| Node.js          | 20 o superior, solo para compilar la interfaz                                                                                                  |
| Composer         | 2.x                                                                                                                                            |
| Servidor web     | Nginx o Apache con **HTTPS obligatorio**                                                                                                       |
| Correo           | Un servicio SMTP transaccional (invitaciones y recuperación de contraseña)                                                                     |
| Procesos         | Un _worker_ de colas y el _scheduler_ de Laravel (cron)                                                                                        |

HTTPS es imprescindible: sin él no funcionan la instalación como app, el modo sin conexión ni las cookies seguras.

## 2. Variables de entorno

Copia `.env.example` a `.env` **en el servidor** (nunca lo subas al repositorio) y ajusta:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://tu-dominio.example

LOG_LEVEL=warning

DB_DATABASE=personal_economi
DB_USERNAME=economia          # usuario propio, no root
DB_PASSWORD=...               # contraseña larga y única

SESSION_SECURE_COOKIE=true    # cookies solo por HTTPS
SESSION_ENCRYPT=true

MAIL_MAILER=smtp
MAIL_HOST=...
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=no-responder@tu-dominio.example

# Copias de seguridad (ver docs/operacion.md)
BACKUP_PATH=/var/backups/economia
BACKUP_KEEP_DAYS=14
# BACKUP_MYSQLDUMP= y BACKUP_MYSQL= solo si los programas no están en el PATH
```

Con MariaDB no hace falta configurar nada especial. La app detecta el motor por la versión del servidor (Laravel usa el driver `mysql` para ambos) y usa `mariadb-dump`/`mariadb`, sin opciones exclusivas de MySQL como `--set-gtid-purged`. En Debian/Ubuntu vienen en el paquete `mariadb-client`.

Genera la clave de cifrado una sola vez con `php artisan key:generate`. **Guarda una copia de `APP_KEY` fuera del servidor**: sin ella no se pueden leer las sesiones ni los datos cifrados de una copia restaurada.

### Usuario de la base de datos

```sql
CREATE DATABASE personal_economi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'economia'@'localhost' IDENTIFIED BY '...';
GRANT ALL PRIVILEGES ON personal_economi.* TO 'economia'@'localhost';
-- Para la prueba semanal de restauración (base de datos temporal):
GRANT ALL PRIVILEGES ON personal_economi_restore_check.* TO 'economia'@'localhost';
```

## 3. Primera instalación

```bash
git clone <repositorio> /var/www/economia && cd /var/www/economia
composer install --no-dev --optimize-autoloader
cp .env.example .env            # y edítalo (apartado 2)
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force     # mascotas e identidad por defecto (idempotente)
php artisan storage:link
npm ci && npm run build
php artisan optimize            # cachés de configuración, rutas, vistas y eventos
php artisan app:create-superuser
php artisan app:mail-test tu-correo@example.com
```

`app:create-superuser` pide los datos de forma interactiva: la contraseña nunca queda en el historial de la terminal. Para convertir en superusuario una cuenta ya existente usa `--promote`.

Permisos: el usuario del servidor web debe poder escribir en `storage/` y `bootstrap/cache/`.

## 4. Servidor web (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name tu-dominio.example;
    root /var/www/economia/public;

    ssl_certificate     /etc/letsencrypt/live/tu-dominio.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.example/privkey.pem;

    index index.php;
    charset utf-8;
    client_max_body_size 8M;   # subida de logotipos e imágenes de mascotas

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known) { deny all; }
}

server {
    listen 80;
    server_name tu-dominio.example;
    return 301 https://$host$request_uri;
}
```

La aplicación envía sus propias cabeceras de seguridad (CSP con _nonce_, `X-Frame-Options`, `Referrer-Policy`, HSTS en producción…), así que no hace falta añadirlas en Nginx.

`/sw.js` y `/manifest.webmanifest` los genera Laravel: no crees archivos con esos nombres en `public/`.

**Detrás de un proxy o balanceador** (Cloudflare, un balanceador de carga…): indica sus direcciones en `bootstrap/app.php` con `$middleware->trustProxies(at: [...])`; si no, la app no sabrá que la conexión es HTTPS.

## 5. Procesos en segundo plano

### Worker de colas (correos)

Los correos (invitaciones, avisos de seguridad) se envían por cola. Ejemplo con systemd (`/etc/systemd/system/economia-worker.service`):

```ini
[Unit]
Description=Economía Personal - cola
After=network.target mysql.service

[Service]
User=www-data
WorkingDirectory=/var/www/economia
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now economia-worker
```

### Scheduler (cron)

```cron
* * * * * www-data cd /var/www/economia && php artisan schedule:run >> /dev/null 2>&1
```

Tareas programadas:

| Tarea                                                  | Cuándo          |
| ------------------------------------------------------ | --------------- |
| `app:generate-recurring` — previsiones de recurrencias | Cada día, 01:30 |
| `app:backup` — copia de seguridad                      | Cada día, 03:00 |
| `app:backup:verify` — prueba de restauración           | Domingos, 04:30 |
| `app:check-integrity` — coherencia de los datos        | Domingos, 05:00 |

Comprueba la programación con `php artisan schedule:list`.

## 6. Actualizar a una versión nueva

```bash
cd /var/www/economia
php artisan app:backup               # copia antes de tocar nada
php artisan down --retry=60
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan db:seed --force
npm ci && npm run build
php artisan optimize
php artisan queue:restart
php artisan up
```

Las personas con la app abierta verán el aviso «Hay una versión nueva de la app» y la actualizarán cuando terminen lo que estén haciendo: nunca se recarga sola. Los movimientos registrados sin conexión se conservan en su dispositivo y se envían al reconectar.

## 7. Lista de comprobación final

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` con `https://`.
- [ ] El certificado HTTPS es válido y HTTP redirige a HTTPS.
- [ ] `php artisan app:mail-test` llega a la bandeja de entrada.
- [ ] Existe al menos un superusuario y puede entrar.
- [ ] `php artisan schedule:list` muestra las cuatro tareas y el cron está activo.
- [ ] El worker de colas está en marcha (`systemctl status economia-worker`).
- [ ] `php artisan app:backup` y `php artisan app:backup:verify` terminan bien.
- [ ] Las copias se llevan fuera del servidor (ver `docs/operacion.md`).
- [ ] `APP_KEY` está guardada en un lugar seguro fuera del servidor.
- [ ] En un móvil, la app se instala y abre el modo sin conexión con la red desactivada.
