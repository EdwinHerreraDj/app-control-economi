<?php

namespace App\Finance;

use App\Enums\TransactionKind;
use App\Enums\TransactionStatus;
use App\Models\Debt;
use App\Models\Transaction;
use App\Models\User;
use App\Support\MoneyFormatter;
use Carbon\CarbonImmutable;

/**
 * Avisos breves para la pantalla de inicio.
 *
 * Solo con datos reales (nada de estimaciones presentadas como hechos), sin
 * juzgar los hábitos de gasto y como mucho tres a la vez.
 */
class Notices
{
    public const LIMIT = 3;

    /**
     * @return list<array{tone: 'warning'|'info', text: string}>
     */
    public function forUser(User $user): array
    {
        $today = $user->today();
        $format = MoneyFormatter::for($user);
        $notices = [];

        $pending = Transaction::query()->ownedBy($user)
            ->where('status', TransactionStatus::Planned->value)
            ->whereNull('voided_at')
            ->whereIn('kind', [TransactionKind::Expense->value, TransactionKind::Income->value])
            ->where('occurred_on', '<', $today->addDays(2)->toDateString())
            ->orderBy('occurred_on')
            ->get();

        // Pagos atrasados: lo más importante.
        // Se comparan fechas de calendario (sin horas ni zonas horarias).
        $day = fn (Transaction $t) => $t->occurred_on->toDateString();
        $todayDate = $today->toDateString();
        $overdue = $pending->filter(fn (Transaction $t) => $t->kind === TransactionKind::Expense && $day($t) < $todayDate);
        if ($overdue->isNotEmpty()) {
            /** @var Transaction $first */
            $first = $overdue->first();
            $since = $day($first) === $today->subDay()->toDateString() ? 'desde ayer' : 'desde el '.$format->day($first->occurred_on);
            $more = $overdue->count() > 1 ? ' (y '.($overdue->count() - 1).' más)' : '';
            $notices[] = ['tone' => 'warning', 'text' => "Tienes un pago pendiente {$since}: {$first->concept}, {$format->money($first->amount, $first->currency)}{$more}."];
        }

        // Lo que toca hoy o mañana.
        foreach ($pending->filter(fn (Transaction $t) => $day($t) >= $todayDate) as $item) {
            $when = $day($item) === $todayDate ? 'Hoy' : 'Mañana';
            $notices[] = ['tone' => 'info', 'text' => $item->kind === TransactionKind::Income
                ? "{$when} esperas cobrar {$item->concept} ({$format->money($item->amount, $item->currency)})."
                : "{$when} te toca pagar {$item->concept} ({$format->money($item->amount, $item->currency)})."];
        }

        // Deudas a punto de terminar.
        foreach (Debt::query()->ownedBy($user)->whereNull('settled_at')->whereNotNull('installment')->get() as $debt) {
            $outstanding = $debt->outstanding();
            $left = $debt->installment > 0 ? (int) ceil($outstanding / $debt->installment) : 0;

            if ($left >= 1 && $left <= 3) {
                $notices[] = ['tone' => 'info', 'text' => $left === 1
                    ? "Te queda 1 cuota de {$debt->concept}."
                    : "Te quedan {$left} cuotas de {$debt->concept}."];
            }
        }

        if ($extra = $this->incomeAboveUsual($user, $today, $format)) {
            $notices[] = $extra;
        }

        if ($top = $this->topSpending($user, $today, $format)) {
            $notices[] = $top;
        }

        return array_slice($notices, 0, self::LIMIT);
    }

    /**
     * «Este mes te han entrado 120 € más de lo habitual» (frente a la media
     * de los tres meses anteriores, solo si hay datos de los tres).
     *
     * @return array{tone: 'info', text: string}|null
     */
    private function incomeAboveUsual(User $user, CarbonImmutable $today, MoneyFormatter $format): ?array
    {
        $income = fn (CarbonImmutable $month) => (int) Transaction::query()->ownedBy($user)
            ->where('kind', TransactionKind::Income->value)
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            ->where('occurred_on', '>=', $month->startOfMonth()->toDateString())->where('occurred_on', '<', $month->endOfMonth()->addDay()->toDateString())
            ->sum('amount');

        $previous = array_map(fn (int $i) => $income($today->startOfMonth()->subMonthsNoOverflow($i)), [1, 2, 3]);

        if (in_array(0, $previous, true)) {
            return null;
        }

        $usual = intdiv(array_sum($previous), 3);
        $difference = $income($today) - $usual;

        // Diferencias pequeñas no merecen un aviso.
        if ($difference <= 0 || $difference * 10 < $usual) {
            return null;
        }

        return ['tone' => 'info', 'text' => "Este mes te han entrado {$format->money($difference)} más de lo habitual."];
    }

    /**
     * La categoría en la que más se ha gastado este mes, sin contar pagos
     * habituales (el alquiler no es noticia). Es un dato, no un reproche.
     *
     * @return array{tone: 'info', text: string}|null
     */
    private function topSpending(User $user, CarbonImmutable $today, MoneyFormatter $format): ?array
    {
        $top = Transaction::query()->ownedBy($user)
            ->where('kind', TransactionKind::Expense->value)
            ->where('status', TransactionStatus::Confirmed->value)
            ->whereNull('voided_at')
            ->whereNull('recurring_rule_id')
            ->whereNull('debt_payment_id')
            ->whereNotNull('category_id')
            ->where('occurred_on', '>=', $today->startOfMonth()->toDateString())->where('occurred_on', '<', $today->addDay()->toDateString())
            ->groupBy('category_id')
            ->selectRaw('category_id, SUM(amount) AS total, COUNT(*) AS times')
            ->orderByDesc('total')
            ->with('category:id,name')
            ->first();

        if ($top === null || (int) $top->getAttribute('times') < 2 || $top->category === null) {
            return null;
        }

        $name = mb_strtolower($top->category->name);

        return ['tone' => 'info', 'text' => "Este mes llevas {$format->money((int) $top->getAttribute('total'))} en {$name}."];
    }
}
