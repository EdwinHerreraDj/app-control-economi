<?php

namespace App\Support;

/**
 * Textos de las páginas de error, en lenguaje cotidiano y sin culpar a la
 * persona. Los usan tanto la página de la app (Inertia) como las vistas
 * estáticas de respaldo (resources/views/errors).
 */
class ErrorMessages
{
    /** Códigos con página propia. */
    public const HANDLED = [403, 404, 419, 429, 500, 503];

    /**
     * @return array{status: int, title: string, message: string, mascot_state: string, retry: bool}
     */
    public static function for(int $status): array
    {
        [$title, $message, $state, $retry] = match ($status) {
            403 => [
                'No tienes acceso a esta página',
                'Esta sección no está disponible para tu cuenta. Si crees que deberías poder entrar, habla con la persona que administra la app.',
                'attention',
                false,
            ],
            404 => [
                'No encontramos esta página',
                'Puede que el enlace esté mal escrito o que lo que buscabas ya no exista. Desde el inicio puedes llegar a todo.',
                'unknown',
                false,
            ],
            419 => [
                'La página ha caducado',
                'Por seguridad, los formularios caducan si pasan mucho tiempo abiertos. Recarga la página y vuelve a intentarlo.',
                'unknown',
                true,
            ],
            429 => [
                'Demasiados intentos seguidos',
                'Por seguridad hemos frenado un momento. Espera un minuto y vuelve a intentarlo.',
                'attention',
                true,
            ],
            503 => [
                'Estamos haciendo mejoras',
                'La app volverá a estar disponible en unos minutos. Tus datos están a salvo.',
                'support',
                true,
            ],
            default => [
                'Algo no ha ido bien',
                'Ha ocurrido un error inesperado. Tus datos están a salvo. Prueba de nuevo en unos minutos; si se repite, avisa a la persona que administra la app.',
                'support',
                true,
            ],
        };

        return [
            'status' => $status,
            'title' => $title,
            'message' => $message,
            'mascot_state' => $state,
            'retry' => $retry,
        ];
    }
}
