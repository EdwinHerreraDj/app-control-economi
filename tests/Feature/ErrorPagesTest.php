<?php

use App\Models\Account;
use App\Models\User;
use App\Support\ErrorMessages;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

test('an unknown page shows the friendly 404 page', function () {
    $this->get('/esta-pagina-no-existe')
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('error')
            ->where('status', 404)
            ->where('title', 'No encontramos esta página')
            ->has('brand.name'));
});

test('another user data answers with the same 404 page', function () {
    $owner = User::factory()->create();
    $account = Account::factory()->for($owner)->create();

    $this->actingAs(User::factory()->create())
        ->put(route('accounts.update', $account), ['name' => 'X'])
        ->assertNotFound();
});

test('forbidden sections show the 403 page', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('admin.users.index'))
        ->assertForbidden()
        ->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 403));
});

test('unexpected errors show a calm page when debug is off', function () {
    config(['app.debug' => false]);
    Route::get('/_prueba-error', fn () => throw new RuntimeException('detalle interno'))->middleware('web');

    $response = $this->get('/_prueba-error')->assertStatus(500);

    $response->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 500));
    expect($response->getContent())->not->toContain('detalle interno');
});

test('json requests keep their json errors', function () {
    $this->getJson('/esta-pagina-no-existe')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});

test('an expired form sends the person back with a notice', function () {
    // La comprobación CSRF no se ejecuta en las pruebas: se simula su 419.
    Route::post('/_prueba-caducada', fn () => abort(419))->middleware('web');

    $this->withHeaders(['X-Inertia' => 'true'])
        ->from('/accounts')
        ->post('/_prueba-caducada')
        ->assertRedirect('/accounts');

    // Fuera de Inertia (carga completa) se muestra la página de error.
    $this->flushHeaders()
        ->post('/_prueba-caducada')
        ->assertStatus(419)
        ->assertInertia(fn (Assert $page) => $page->component('error')->where('status', 419));
});

test('maintenance and fallback pages render without the app', function (int $status) {
    $html = view("errors.{$status}")->render();

    expect($html)
        ->toContain('Error '.$status)
        ->toContain(ErrorMessages::for($status)['title'])
        ->not->toContain('/build/');
})->with([403, 404, 419, 429, 500, 503]);

test('maintenance mode shows the static page and inertia visits reload to it', function () {
    $this->app->maintenanceMode()->activate([]);

    try {
        $this->get('/dashboard')
            ->assertStatus(503)
            ->assertSee('Estamos haciendo mejoras')
            ->assertSee('modo sin conexión');

        $this->withHeaders(['X-Inertia' => 'true'])
            ->get('/dashboard')
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location');
    } finally {
        $this->app->maintenanceMode()->deactivate();
    }
});
