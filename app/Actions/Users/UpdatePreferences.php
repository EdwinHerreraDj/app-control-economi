<?php

namespace App\Actions\Users;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\FinancialFootprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdatePreferences
{
    public function __construct(private readonly FinancialFootprint $footprint) {}

    /**
     * Guarda las preferencias personales.
     *
     * La moneda solo puede cambiarse mientras no haya datos financieros: los
     * importes guardados conservan su moneda original y no se reinterpretan.
     */
    public function handle(User $user, string $currency, string $numberLocale, string $timezone, string $locale): void
    {
        DB::transaction(function () use ($user, $currency, $numberLocale, $timezone, $locale) {
            $previousCurrency = $user->currency;
            $currencyChanged = $previousCurrency !== null && $previousCurrency !== $currency;

            if ($currencyChanged && $this->footprint->hasRecords($user)) {
                throw ValidationException::withMessages([
                    'currency' => "Ya tienes movimientos registrados en {$previousCurrency}. Para no alterar tus importes, la moneda principal no puede cambiarse por ahora.",
                ]);
            }

            $user->forceFill([
                'currency' => $currency,
                'number_locale' => $numberLocale,
                'timezone' => $timezone,
                'locale' => $locale,
                'onboarded_at' => $user->onboarded_at ?? now(),
            ])->save();

            if ($currencyChanged) {
                AuditLog::record('user.currency_changed', $user, [
                    'from' => $previousCurrency,
                    'to' => $currency,
                ], actor: $user);
            }
        });
    }
}
