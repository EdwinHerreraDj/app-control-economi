<?php

namespace App\Mascots;

use App\Enums\MascotState;
use App\Models\Debt;
use App\Models\Mascot;
use App\Models\MascotMessage;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Support\Money;
use App\Support\MoneyFormatter;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;

/**
 * Lo que la mascota muestra en el panel: estado, gesto pasajero y mensaje.
 *
 * Reglas (CONTEXT.md §9):
 * - El estado sale de los mismos cálculos del panel (previsión y calidad
 *   de los datos); tener una deuda no basta para un estado desfavorable.
 * - Sin información suficiente prevalece un estado neutral.
 * - La bienvenida y la celebración son gestos breves que no sustituyen al
 *   estado financiero, que se sigue mostrando.
 * - Nunca castiga: no hay estados de enfermedad, tristeza ni culpa.
 */
class MascotCompanion
{
    /** Días durante los que se celebra un hito reciente (una vez por sesión). */
    private const CELEBRATION_DAYS = 7;

    public function __construct(private readonly MessageRenderer $renderer) {}

    /**
     * @param  array{tone: string, title: string, text: string}  $headline
     * @param  array<string, mixed>|null  $forecast
     * @return array<string, mixed>|null
     */
    public function forDashboard(User $user, array $headline, ?array $forecast, Session $session): ?array
    {
        if ($user->mascot_visibility === 'hidden') {
            return null;
        }

        $mascot = $this->mascotFor($user);

        if ($mascot === null) {
            return null;
        }

        [$state, $reason] = $this->stateFor($headline);
        [$transient, $milestone] = $this->transientFor($user, $session);

        // El nombre y los mensajes los define el superusuario.
        $name = $mascot->name;
        $format = MoneyFormatter::for($user);
        $currency = (string) $user->currency;

        $values = [
            'nombre' => explode(' ', trim($user->name))[0],
            'mascota' => $name,
            'fecha' => isset($forecast['lowest_on']) ? $format->day(CarbonImmutable::parse($forecast['lowest_on'])) : null,
            'faltante' => isset($forecast['shortfall']) ? $format->money(Money::toMinor($forecast['shortfall'], $currency)) : null,
            'saldo_minimo' => isset($forecast['lowest']) ? $format->money(Money::toMinor($forecast['lowest'], $currency, allowNegative: true)) : null,
            'objetivo' => $milestone,
        ];

        // El mensaje acompaña al gesto pasajero si lo hay; si no, al estado.
        $messageState = $transient ?? $state;

        return [
            'id' => $mascot->id,
            'name' => $name,
            'images' => $mascot->images(),
            'state' => $state->value,
            'transient' => $transient?->value,
            'reason' => $reason,
            'message' => $this->message($mascot, $messageState, $values, $user),
            'visibility' => $user->mascot_visibility,
            'motion' => $user->mascot_motion,
        ];
    }

    /**
     * La mascota la decide el superusuario: es la predeterminada para todos.
     */
    public function mascotFor(User $user): ?Mascot
    {
        return Mascot::default()?->load('assets');
    }

    /**
     * @param  array{tone: string}  $headline
     * @return array{0: MascotState, 1: string}
     */
    private function stateFor(array $headline): array
    {
        return match ($headline['tone']) {
            'support' => [MascotState::Support, 'La previsión indica un momento ajustado.'],
            'attention' => [MascotState::Attention, 'El margen previsto es reducido.'],
            'unknown' => [MascotState::Unknown, 'Faltan datos o están desactualizados.'],
            default => [MascotState::Idle, 'Los pagos previstos están cubiertos.'],
        };
    }

    /**
     * Saludo al entrar (una vez por sesión) o celebración de un hito
     * reciente y confirmado (una vez por hito y sesión).
     *
     * @return array{0: MascotState|null, 1: string|null}
     */
    private function transientFor(User $user, Session $session): array
    {
        $since = now()->subDays(self::CELEBRATION_DAYS);
        $celebrated = (array) $session->get('mascot.celebrated', []);

        $goal = SavingsGoal::query()->ownedBy($user)->whereNotNull('achieved_at')
            ->where('achieved_at', '>=', $since)->latest('achieved_at')->first();
        $debt = Debt::query()->ownedBy($user)->whereNotNull('settled_at')
            ->where('settled_at', '>=', $since)->latest('settled_at')->first();

        foreach ([['goal', $goal, $goal?->name], ['debt', $debt, $debt ? "deuda con {$debt->creditor}" : null]] as [$type, $model, $label]) {
            if ($model !== null && ! in_array("{$type}:{$model->id}", $celebrated, true)) {
                $session->put('mascot.celebrated', [...$celebrated, "{$type}:{$model->id}"]);

                return [MascotState::Celebration, $label];
            }
        }

        if (! $session->get('mascot.greeted', false)) {
            $session->put('mascot.greeted', true);

            return [MascotState::Welcome, null];
        }

        return [null, null];
    }

    /**
     * @param  array<string, string|null>  $values
     */
    private function message(Mascot $mascot, MascotState $state, array $values, User $user): ?string
    {
        $templates = MascotMessage::query()
            ->where('active', true)
            ->where('state', $state->value)
            ->where(fn ($query) => $query->where('mascot_id', $mascot->id)->orWhereNull('mascot_id'))
            ->orderByRaw('mascot_id IS NULL') // primero los propios de la mascota
            ->orderBy('id')
            ->pluck('template')
            // Solo plantillas cuyas variables tengan valor ahora mismo.
            ->filter(function (string $template) use ($values) {
                preg_match_all('/\{([a-z_]+)\}/', $template, $matches);

                return collect($matches[1])->every(fn (string $key) => ($values[$key] ?? null) !== null);
            })
            ->values();

        if ($templates->isEmpty()) {
            return null;
        }

        // Variedad estable: el mismo mensaje durante el día.
        $index = crc32($user->id.'|'.$state->value.'|'.now()->toDateString()) % $templates->count();

        return $this->renderer->render((string) $templates[$index], $values);
    }
}
