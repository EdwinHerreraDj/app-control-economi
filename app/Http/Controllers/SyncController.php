<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Sync\OfflineSnapshot;
use App\Sync\OperationProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sincronización del modo sin conexión: el dispositivo envía lo registrado
 * y descarga una copia de consulta de los datos confirmados.
 */
class SyncController extends Controller
{
    public function snapshot(Request $request, OfflineSnapshot $snapshot): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()
            ->json($snapshot->for($user))
            // Datos financieros: que ninguna caché intermedia los guarde.
            ->header('Cache-Control', 'no-store, private');
    }

    public function push(Request $request, OperationProcessor $processor): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'user_id' => ['required', 'integer'],
            'operations' => ['required', 'array', 'max:'.OperationProcessor::MAX_BATCH],
            'operations.*.uuid' => ['required', 'uuid', 'distinct'],
            'operations.*.type' => ['required', 'string', 'max:40'],
            'operations.*.payload' => ['required', 'array'],
            'operations.*.created_at' => ['nullable', 'string', 'max:40'],
            'operations.*.confirm_duplicate' => ['sometimes', 'boolean'],
        ]);

        // Lo registrado en este dispositivo pertenece a otra cuenta: nunca se
        // aplica a la sesión actual.
        if ((int) $validated['user_id'] !== $user->id) {
            return response()->json([
                'code' => 'user_mismatch',
                'message' => 'Estos cambios se registraron con otra cuenta. Inicia sesión con ella para enviarlos.',
            ], 409);
        }

        $results = [];

        /** @var list<array{uuid: string, type: string, payload: array<string, mixed>, created_at?: string|null, confirm_duplicate?: bool}> $operations */
        $operations = $validated['operations'];

        foreach ($operations as $operation) {
            $results[] = $processor->process($user, $operation);
        }

        return response()->json(['results' => $results])->header('Cache-Control', 'no-store, private');
    }
}
