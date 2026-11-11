<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Throwable;

/**
 * Comprueba la configuración del correo (invitaciones y recuperación de
 * contraseña) enviando un mensaje de prueba.
 */
class SendTestMail extends Command
{
    protected $signature = 'app:mail-test {email : Dirección a la que enviar el mensaje de prueba}';

    protected $description = 'Envía un correo de prueba para comprobar la configuración del correo';

    public function handle(): int
    {
        $email = (string) $this->argument('email');

        if (Validator::make(['email' => $email], ['email' => ['required', 'email']])->fails()) {
            $this->components->error('La dirección de correo no es válida.');

            return self::FAILURE;
        }

        $app = (string) config('app.name');

        try {
            Mail::raw(
                "Este es un mensaje de prueba de {$app}. Si lo recibes, las invitaciones y la recuperación de contraseña podrán enviarse.",
                fn ($message) => $message->to($email)->subject("Prueba de correo · {$app}"),
            );
        } catch (Throwable $exception) {
            $this->components->error('No se ha podido enviar: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->components->info("Mensaje enviado a {$email} con el transporte «".config('mail.default').'». Revisa la bandeja de entrada (y el correo no deseado).');

        return self::SUCCESS;
    }
}
