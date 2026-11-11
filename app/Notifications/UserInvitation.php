<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UserInvitation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        #[\SensitiveParameter] public readonly string $token,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $url = route('invitation.show', [
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        $hours = intdiv((int) config('auth.passwords.invitations.expire'), 60);

        return (new MailMessage)
            ->subject('Te han invitado a '.config('app.name'))
            ->greeting('¡Hola, '.$notifiable->name.'!')
            ->line('Se ha creado una cuenta para ti en '.config('app.name').'.')
            ->line('Para empezar, establece tu contraseña desde el siguiente enlace.')
            ->action('Activar mi cuenta', $url)
            ->line("El enlace caduca en {$hours} horas y solo puede usarse una vez.")
            ->line('Si no esperabas esta invitación, puedes ignorar este mensaje.')
            ->salutation('Un saludo');
    }
}
