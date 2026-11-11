<?php

namespace App\Http\Controllers\Admin;

use App\Enums\MascotState;
use App\Http\Controllers\Controller;
use App\Mascots\MessageRenderer;
use App\Models\MascotMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Mensajes comunes de las mascotas por situación.
 */
class MascotMessageController extends Controller
{
    public function store(Request $request, MessageRenderer $renderer): RedirectResponse
    {
        MascotMessage::create([...$this->validated($request, $renderer), 'mascot_id' => null]);
        $this->toast('Mensaje añadido.');

        return back();
    }

    public function update(Request $request, MascotMessage $message, MessageRenderer $renderer): RedirectResponse
    {
        $message->update($this->validated($request, $renderer));
        $this->toast('Mensaje actualizado.');

        return back();
    }

    public function destroy(MascotMessage $message): RedirectResponse
    {
        $message->delete();
        $this->toast('Mensaje eliminado.');

        return back();
    }

    /**
     * @return array{state: string, template: string, active: bool}
     */
    private function validated(Request $request, MessageRenderer $renderer): array
    {
        $validated = $request->validate([
            'state' => ['required', Rule::in(array_map(fn (MascotState $s) => $s->value, MascotState::moods()))],
            'template' => ['required', 'string', 'max:280'],
            'active' => ['boolean'],
        ], attributes: ['state' => 'situación', 'template' => 'mensaje']);

        $unknown = $renderer->unknownVariables($validated['template']);

        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'template' => 'Variables no permitidas: {'.implode('}, {', $unknown).'}.',
            ]);
        }

        return [
            'state' => $validated['state'],
            'template' => trim($validated['template']),
            'active' => $request->boolean('active', true),
        ];
    }
}
