<?php

namespace App\Http\Responses;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Http\Responses\SuccessfulPasswordResetLinkRequestResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Respuesta idéntica exista o no la cuenta (o esté limitada la petición):
 * se descarta a propósito el motivo real del fallo, para que el formulario
 * de recuperación no sirva para averiguar qué correos están registrados.
 */
class NeutralPasswordResetLinkResponse extends SuccessfulPasswordResetLinkRequestResponse implements FailedPasswordResetLinkRequestResponse
{
    /**
     * @param  Request  $request
     */
    public function toResponse($request): Response
    {
        $this->status = Password::RESET_LINK_SENT;

        return parent::toResponse($request);
    }
}
