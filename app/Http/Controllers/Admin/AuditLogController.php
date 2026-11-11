<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Mascot;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    /** Descripción legible de cada acción registrada. */
    private const ACTIONS = [
        'superuser.created' => 'Superusuario creado desde consola',
        'superuser.promoted' => 'Cuenta promovida a superusuario desde consola',
        'user.created' => 'Usuario dado de alta',
        'user.invitation_sent' => 'Invitación enviada',
        'user.activated' => 'Cuenta activada',
        'user.updated' => 'Usuario modificado',
        'user.suspended' => 'Cuenta suspendida',
        'user.reactivated' => 'Cuenta reactivada',
        'user.password_reset_link_sent' => 'Enlace de recuperación enviado',
        'user.password_reset' => 'Contraseña restablecida',
        'user.other_sessions_closed' => 'Cierre de sesiones en otros dispositivos',
        'user.currency_changed' => 'Cambio de moneda principal',
        'user.created_with_password' => 'Usuario dado de alta con contraseña temporal',
        'user.temporary_password_set' => 'Contraseña temporal puesta por el administrador',
        'user.password_chosen' => 'Contraseña temporal sustituida por la propia',
        'brand.updated' => 'Identidad visual modificada',
        'brand.asset_uploaded' => 'Recurso de identidad subido',
        'brand.asset_reset' => 'Recurso de identidad restaurado',
        'mascot.created' => 'Mascota creada',
        'mascot.asset_uploaded' => 'Imagen de mascota subida',
        'mascot.published' => 'Mascota publicada',
        'mascot.archived' => 'Mascota archivada',
        'mascot.made_default' => 'Mascota predeterminada cambiada',
    ];

    public function index(): Response
    {
        $logs = AuditLog::query()
            ->with(['actor:id,name,email', 'subject'])
            ->latest('id')
            ->paginate(50)
            ->through(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => self::ACTIONS[$log->action] ?? $log->action,
                'actor' => $log->actor->name ?? 'Sistema',
                'subject' => $log->subject instanceof User || $log->subject instanceof Mascot ? $log->subject->name : null,
                'properties' => $log->properties,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/audit/index', ['logs' => $logs]);
    }
}
