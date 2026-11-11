<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Models\AuditLog;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/security', [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'sessions' => $this->sessions($request),
        ]);
    }

    /**
     * Al cambiar la contraseña se cierran las sesiones del resto de
     * dispositivos (middleware AuthenticateSession); este se mantiene.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'password' => $request->password,
        ]);

        // Renueva la cookie de "mantener la sesión" de este dispositivo para
        // que siga siendo válida con la nueva contraseña.
        Auth::guard('web')->logoutOtherDevices($request->password);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contraseña actualizada. Se han cerrado las sesiones de tus otros dispositivos.']);

        return back();
    }

    /**
     * Revoca el acceso de los demás dispositivos, incluido "mantener la sesión".
     */
    public function destroyOtherSessions(Request $request): RedirectResponse
    {
        $request->validate(
            ['password' => ['required', 'string', 'current_password']],
            attributes: ['password' => 'contraseña'],
        );

        Auth::guard('web')->logoutOtherDevices($request->input('password'));

        if ($this->usesDatabaseSessions()) {
            $this->sessionTable()
                ->where('user_id', $request->user()->getAuthIdentifier())
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        AuditLog::record('user.other_sessions_closed', $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Se han cerrado las sesiones de tus otros dispositivos.']);

        return back();
    }

    /**
     * @return array<int, array{id: string, ip_address: string|null, agent: array{browser: string, platform: string, is_mobile: bool}, last_active: string, is_current: bool}>
     */
    private function sessions(Request $request): array
    {
        if (! $this->usesDatabaseSessions()) {
            return [];
        }

        return $this->sessionTable()
            ->where('user_id', $request->user()->getAuthIdentifier())
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn (object $session) => [
                // No se expone el identificador real de la sesión.
                'id' => hash('sha256', $session->id),
                'ip_address' => is_string($session->ip_address) ? $session->ip_address : null,
                'agent' => $this->describeAgent((string) $session->user_agent),
                'last_active' => Carbon::createFromTimestamp($session->last_activity)->toIso8601String(),
                'is_current' => $session->id === $request->session()->getId(),
            ])
            ->values()
            ->all();
    }

    /**
     * Descripción aproximada del dispositivo a partir del user agent.
     *
     * @return array{browser: string, platform: string, is_mobile: bool}
     */
    private function describeAgent(string $agent): array
    {
        $browser = match (true) {
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/') => 'Opera',
            str_contains($agent, 'Firefox/') => 'Firefox',
            str_contains($agent, 'Chrome/') => 'Chrome',
            str_contains($agent, 'Safari/') => 'Safari',
            default => 'Navegador desconocido',
        };

        $platform = match (true) {
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'iPhone'), str_contains($agent, 'iPad') => 'iOS',
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'Mac OS') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => 'Sistema desconocido',
        };

        return [
            'browser' => $browser,
            'platform' => $platform,
            'is_mobile' => (bool) preg_match('/Mobile|Android|iPhone/i', $agent),
        ];
    }

    private function usesDatabaseSessions(): bool
    {
        return config('session.driver') === 'database';
    }

    private function sessionTable(): Builder
    {
        return DB::connection(config('session.connection'))->table(config('session.table', 'sessions'));
    }
}
