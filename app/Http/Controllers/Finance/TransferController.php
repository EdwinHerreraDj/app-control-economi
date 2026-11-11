<?php

namespace App\Http\Controllers\Finance;

use App\Actions\Finance\RecordTransfer;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\TransferRequest;
use App\Http\Requests\Finance\VoidRequest;
use App\Models\Transfer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class TransferController extends Controller
{
    public function store(TransferRequest $request, RecordTransfer $record): RedirectResponse
    {
        $record->create($request->user(), $request->payload());
        $this->toast('Transferencia registrada.');

        return back();
    }

    public function update(TransferRequest $request, Transfer $transfer, RecordTransfer $record): RedirectResponse
    {
        Gate::authorize('update', $transfer);

        $record->update($transfer, $request->payload());
        $this->toast('Transferencia actualizada.');

        return back();
    }

    public function confirm(Transfer $transfer, RecordTransfer $record): RedirectResponse
    {
        Gate::authorize('update', $transfer);

        $record->confirm($transfer);
        $this->toast('Transferencia marcada como realizada.');

        return back();
    }

    public function void(VoidRequest $request, Transfer $transfer, RecordTransfer $record): RedirectResponse
    {
        Gate::authorize('update', $transfer);

        $record->void($transfer, $request->validated('reason'));
        $this->toast('Transferencia anulada en ambas cuentas.');

        return back();
    }
}
