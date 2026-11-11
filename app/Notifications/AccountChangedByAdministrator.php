<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Aviso a la persona cuando el superusuario cambia el acceso a su cuenta
 * (contraseña temporal o correo). Así ningún cambio que permita entrar en
 * una cuenta ajena pasa desapercibido para su titular.
 */
class AccountChangedByAdministrator extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  'temporary_password'|'email_changed'  $change
     */
    public function __construct(
        public readonly string $change,
        public readonly string $name,
        public readonly ?string $newEmail = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $app = (string) config('app.name');
        $message = (new MailMessage)
            ->subject("Cambio en el acceso a tu cuenta de {$app}")
            ->greeting("Hola, {$this->name}:");

        $message = $this->change === 'temporary_password'
            ? $message
                ->line('El administrador ha puesto una contraseña temporal a tu cuenta y ha cerrado tus sesiones abiertas.')
                ->line('Al entrar con ella tendrás que elegir una contraseña nueva.')
            : $message
                ->line("El administrador ha cambiado el correo de tu cuenta a {$this->newEmail}.")
                ->line('A partir de ahora los avisos y la recuperación de contraseña llegarán a esa dirección.');

        return $message
            ->line('Si no lo has pedido tú, contacta cuanto antes con el administrador.')
            ->salutation('Un saludo');
    }
}
