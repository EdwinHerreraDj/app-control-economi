<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Users\ChangeUserStatus;
use App\Actions\Users\InviteUser;
use App\Actions\Users\SendInvitation;
use App\Actions\Users\SetTemporaryPassword;
use App\Actions\Users\UpdateUser;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\TemporaryPasswordRequest;
use App\Http\Requests\Admin\UserRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Gestión de cuentas por el superusuario. Solo expone datos de identidad y
 * acceso: nunca información financiera de los usuarios.
 */
class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'status' => $user->status->value,
                'email_verified' => $user->email_verified_at !== null,
                'must_change_password' => $user->must_change_password,
                'invited_at' => $user->invited_at?->toIso8601String(),
                'activated_at' => $user->activated_at?->toIso8601String(),
                'created_at' => $user->created_at?->toIso8601String(),
                'is_current' => $user->is($request->user()),
            ]);

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => ['search' => $search],
            'roles' => collect(UserRole::cases())->map(fn (UserRole $role) => [
                'value' => $role->value,
                'label' => $role->label(),
            ]),
            'statuses' => collect(UserStatus::cases())->mapWithKeys(fn (UserStatus $status) => [
                $status->value => $status->label(),
            ]),
        ]);
    }

    public function store(UserRequest $request, InviteUser $inviteUser, SetTemporaryPassword $passwords): RedirectResponse
    {
        if ($request->withPassword()) {
            $user = $passwords->create(
                $request->validated('name'),
                $request->validated('email'),
                $request->role(),
                $request->string('password')->toString(),
            );

            return $this->success("Cuenta de {$user->name} creada. Al entrar por primera vez tendrá que elegir su propia contraseña.");
        }

        $user = $inviteUser->handle(
            $request->validated('name'),
            $request->validated('email'),
            $request->role(),
        );

        return $this->success("Se ha enviado una invitación a {$user->email}.");
    }

    public function setTemporaryPassword(TemporaryPasswordRequest $request, User $user, SetTemporaryPassword $passwords): RedirectResponse
    {
        $passwords->reset($request->user(), $user, $request->string('password')->toString());

        return $this->success("Contraseña temporal puesta a {$user->name}. Tendrá que cambiarla al entrar y se han cerrado sus sesiones.");
    }

    public function update(UserRequest $request, User $user, UpdateUser $updateUser): RedirectResponse
    {
        $updateUser->handle(
            $request->user(),
            $user,
            $request->validated('name'),
            $request->validated('email'),
            $request->role(),
        );

        return $this->success('Usuario actualizado.');
    }

    public function suspend(Request $request, User $user, ChangeUserStatus $changeUserStatus): RedirectResponse
    {
        $changeUserStatus->suspend($request->user(), $user);

        return $this->success("La cuenta de {$user->name} está suspendida y se han cerrado sus sesiones.");
    }

    public function reactivate(User $user, ChangeUserStatus $changeUserStatus): RedirectResponse
    {
        $changeUserStatus->reactivate($user);

        return $this->success("La cuenta de {$user->name} se ha reactivado.");
    }

    public function resendInvitation(User $user, SendInvitation $sendInvitation): RedirectResponse
    {
        $sendInvitation->handle($user);

        return $this->success("Se ha enviado una nueva invitación a {$user->email}. El enlace anterior ya no es válido.");
    }

    public function sendPasswordReset(User $user): RedirectResponse
    {
        if (! $user->isActive()) {
            throw ValidationException::withMessages([
                'user' => 'Solo se pueden enviar enlaces de recuperación a cuentas activas.',
            ]);
        }

        $status = Password::broker()->sendResetLink(['email' => $user->email]);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'user' => 'Ya se envió un enlace hace poco. Espera un momento antes de volver a intentarlo.',
            ]);
        }

        AuditLog::record('user.password_reset_link_sent', $user);

        return $this->success("Se ha enviado un enlace de recuperación a {$user->email}.");
    }

    private function success(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
