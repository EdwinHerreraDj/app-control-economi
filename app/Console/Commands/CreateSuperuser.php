<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/**
 * Crea el primer superusuario (o promueve una cuenta existente con --promote).
 *
 * La contraseña se pide siempre de forma oculta: nunca se acepta como
 * argumento para que no quede en el historial de la terminal.
 */
class CreateSuperuser extends Command
{
    protected $signature = 'app:create-superuser
                            {--promote : Convierte en superusuario una cuenta que ya existe}';

    protected $description = 'Crea un superusuario o promueve una cuenta existente';

    public function handle(): int
    {
        $email = Str::lower(trim(text(
            label: 'Correo electrónico',
            required: 'El correo es obligatorio.',
            validate: fn (string $value) => Validator::make(
                ['email' => trim($value)],
                ['email' => ['email', 'max:255']],
                ['email.email' => 'Introduce un correo válido.'],
            )->errors()->first('email') ?: null,
        )));

        $existing = User::query()->where('email', $email)->first();

        return $existing
            ? $this->promote($existing)
            : $this->create($email);
    }

    private function create(string $email): int
    {
        if ($this->option('promote')) {
            $this->components->error("No existe ninguna cuenta con el correo {$email}.");

            return self::FAILURE;
        }

        $name = trim(text(
            label: 'Nombre',
            required: 'El nombre es obligatorio.',
            validate: fn (string $value) => mb_strlen(trim($value)) > 255 ? 'El nombre no puede superar 255 caracteres.' : null,
        ));

        $plainPassword = password(
            label: 'Contraseña',
            required: 'La contraseña es obligatoria.',
            validate: fn (string $value) => Validator::make(
                ['password' => $value],
                ['password' => [Password::default()]],
            )->errors()->first('password') ?: null,
            hint: 'No se mostrará mientras la escribes.',
        );

        $confirmation = password(label: 'Repite la contraseña', required: true);

        if (! hash_equals($plainPassword, $confirmation)) {
            $this->components->error('Las contraseñas no coinciden. No se ha creado ninguna cuenta.');

            return self::FAILURE;
        }

        try {
            $user = DB::transaction(function () use ($name, $email, $plainPassword) {
                $user = new User(['name' => $name, 'email' => $email, 'password' => $plainPassword]);
                $user->forceFill([
                    'role' => UserRole::Superuser,
                    'status' => UserStatus::Active,
                    'email_verified_at' => now(),
                    'activated_at' => now(),
                ])->save();

                AuditLog::record('superuser.created', $user);

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            $this->components->error("Ya existe una cuenta con el correo {$email}.");

            return self::FAILURE;
        }

        $this->components->info("Superusuario {$user->name} <{$user->email}> creado. Ya puede iniciar sesión.");

        return self::SUCCESS;
    }

    private function promote(User $user): int
    {
        if ($user->isSuperuser()) {
            $this->components->warn("{$user->email} ya es superusuario. No se ha modificado nada.");

            return self::SUCCESS;
        }

        if (! $this->option('promote')) {
            $this->components->error("Ya existe una cuenta con el correo {$user->email}.");
            $this->line('  Para convertirla en superusuario, ejecuta: php artisan app:create-superuser --promote');

            return self::FAILURE;
        }

        $this->components->twoColumnDetail('Nombre', $user->name);
        $this->components->twoColumnDetail('Correo', $user->email);
        $this->components->twoColumnDetail('Rol actual', $user->role->label());
        $this->components->twoColumnDetail('Estado', $user->status->label());

        if (! confirm("¿Convertir a {$user->name} en superusuario?", default: false)) {
            $this->components->info('Operación cancelada. No se ha modificado nada.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($user) {
            $user->forceFill(['role' => UserRole::Superuser])->save();

            AuditLog::record('superuser.promoted', $user, ['previous_role' => UserRole::User->value]);
        });

        $this->components->info("{$user->name} ahora es superusuario.");

        if (! $user->isActive()) {
            $this->components->warn("La cuenta sigue en estado «{$user->status->label()}»: no podrá entrar hasta que esté activa.");
        }

        return self::SUCCESS;
    }
}
