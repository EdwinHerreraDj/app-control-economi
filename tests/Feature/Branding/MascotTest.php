<?php

use App\Enums\MascotState;
use App\Mascots\MessageRenderer;
use App\Models\Account;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Mascot;
use App\Models\MascotMessage;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\MascotSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    $this->seed(MascotSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-11-11 10:00', 'Europe/Madrid'));
    $this->user = User::factory()->create(['currency' => 'EUR', 'timezone' => 'Europe/Madrid']);
});

function mascotPng(int $size = 512): string
{
    $image = imagecreatetruecolor($size, $size);
    imagesavealpha($image, true);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    ob_start();
    imagepng($image);

    return (string) ob_get_clean();
}

function dashboardMascot(): array
{
    $mascot = null;
    test()->actingAs(test()->user)->get(route('dashboard'))->assertInertia(function (Assert $page) use (&$mascot) {
        $mascot = $page->toArray()['props']['mascot'];
    });

    return (array) $mascot;
}

test('the seeder creates two complete, published mascots and is idempotent', function () {
    $this->seed(MascotSeeder::class);

    expect(Mascot::count())->toBe(2)
        ->and(Mascot::where('is_default', true)->value('slug'))->toBe('brote')
        ->and(Mascot::where('slug', 'pita')->first()->assets()->count())->toBe(7)
        ->and(MascotMessage::whereNull('mascot_id')->count())->toBe(12);
});

test('without accounts the mascot waits calmly and first greets the user', function () {
    $first = dashboardMascot();

    expect($first['name'])->toBe('Brote')
        ->and($first['state'])->toBe('unknown')
        ->and($first['transient'])->toBe('welcome')
        ->and($first['message'])->toContain('Hola');

    // El saludo es una vez por sesión.
    expect(dashboardMascot()['transient'])->toBeNull();
});

test('the mascot state comes from the same forecast as the dashboard', function () {
    $account = Account::factory()->for($this->user)->create(['initial_balance' => 10000]);
    $category = Category::factory()->for($this->user)->create();
    Transaction::factory()->for($account)->planned()->create(['amount' => 18500, 'occurred_on' => '2026-11-20', 'category_id' => $category->id]);

    $mascot = dashboardMascot();

    expect($mascot['state'])->toBe('support');

    // Mensaje del estado (no del saludo) en la siguiente visita, con datos reales y sin llaves.
    $again = dashboardMascot();
    expect($again['message'])->not->toContain('{')
        ->and($again['message'])->toMatch('/85,00|ajustado/');
});

test('having a debt alone does not make the mascot worried', function () {
    Account::factory()->for($this->user)->create(['initial_balance' => 500000]);
    Debt::forceCreate([
        'user_id' => $this->user->id, 'creditor' => 'Banco', 'concept' => 'Hipoteca', 'currency' => 'EUR',
        'principal' => 10000000, 'started_on' => '2020-01-01',
    ]);

    expect(dashboardMascot()['state'])->toBe('idle');
});

test('a recently reached goal is celebrated once', function () {
    Account::factory()->for($this->user)->create(['initial_balance' => 100000]);
    SavingsGoal::forceCreate(['user_id' => $this->user->id, 'name' => 'Viaje', 'target_amount' => 100, 'currency' => 'EUR', 'achieved_at' => now()->subDay()]);

    $first = dashboardMascot();
    expect($first['transient'])->toBe('celebration')
        ->and($first['message'])->toMatch('/Viaje|hito/');

    expect(dashboardMascot()['transient'])->not->toBe('celebration');
});

test('users only adjust visibility and animations, never the mascot or its messages', function () {
    $pita = Mascot::where('slug', 'pita')->first();

    // Intentar elegir mascota, nombre o silenciar mensajes no tiene efecto.
    $this->actingAs($this->user)->put(route('mascot.update'), [
        'mascot_id' => $pita->id, 'mascot_name' => 'Lechu', 'mascot_messages' => false,
        'mascot_visibility' => 'shown', 'mascot_motion' => 'reduced',
    ])->assertSessionHasNoErrors();

    $mascot = dashboardMascot();
    expect($mascot['name'])->toBe('Brote')
        ->and($mascot['message'])->not->toBeNull()
        ->and($mascot['motion'])->toBe('reduced');

    $this->actingAs($this->user)->put(route('mascot.update'), ['mascot_visibility' => 'flotando', 'mascot_motion' => 'mucho'])
        ->assertSessionHasErrors(['mascot_visibility', 'mascot_motion']);

    $this->actingAs($this->user)->patch(route('mascot.visibility'), ['mascot_visibility' => 'hidden'])->assertSessionHasNoErrors();
    $this->actingAs($this->user)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('mascot', null));
});

test('the superuser decides which mascot everyone sees', function () {
    $admin = User::factory()->superuser()->create();
    $pita = Mascot::where('slug', 'pita')->first();

    expect(dashboardMascot()['name'])->toBe('Brote');

    $this->actingAs($admin)->post(route('admin.mascots.default', $pita))->assertSessionHasNoErrors();
    $this->actingAs($admin)->put(route('admin.mascots.update', $pita), ['name' => 'Pita la sabia', 'description' => 'x'])->assertSessionHasNoErrors();

    expect(dashboardMascot())
        ->id->toBe($pita->id)
        ->name->toBe('Pita la sabia');

    // La que ven todos no se puede archivar; una borrador no puede ser la de todos.
    $this->actingAs($admin)->post(route('admin.mascots.archive', $pita))->assertSessionHasErrors('mascot');
    $draft = Mascot::create(['slug' => 'borrador', 'name' => 'Borrador', 'status' => 'draft']);
    $this->actingAs($admin)->post(route('admin.mascots.default', $draft))->assertSessionHasErrors('mascot');
});

test('a new mascot is published only with its cover and resting images', function () {
    $admin = User::factory()->superuser()->create();
    $this->actingAs($admin)->post(route('admin.mascots.store'), ['name' => 'Nube'])->assertRedirect();
    $mascot = Mascot::where('name', 'Nube')->firstOrFail();

    expect($mascot->status)->toBe('draft');

    $this->actingAs($admin)->post(route('admin.mascots.publish', $mascot))->assertSessionHasErrors('mascot');

    // Animación sin imagen estática previa: rechazada.
    $this->actingAs($admin)->post(route('admin.mascots.assets.upload', [$mascot, 'idle']), [
        'variant' => 'animated', 'file' => UploadedFile::fake()->createWithContent('a.webp', mascotPng()),
    ])->assertSessionHasErrors('file');

    // Medidas incorrectas.
    $this->actingAs($admin)->post(route('admin.mascots.assets.upload', [$mascot, 'idle']), [
        'variant' => 'static', 'file' => UploadedFile::fake()->createWithContent('i.png', mascotPng(300)),
    ])->assertSessionHasErrors('file');

    foreach (['cover', 'idle'] as $state) {
        $this->actingAs($admin)->post(route('admin.mascots.assets.upload', [$mascot, $state]), [
            'variant' => 'static', 'file' => UploadedFile::fake()->createWithContent("{$state}.png", mascotPng()),
        ])->assertSessionHasNoErrors();
    }

    $this->actingAs($admin)->post(route('admin.mascots.publish', $mascot))->assertSessionHasNoErrors();
    expect($mascot->fresh()->status)->toBe('published');

    // Los estados sin imagen propia usan la de reposo.
    $images = $mascot->fresh()->images();
    expect($images['support']['static'])->toBe($images['idle']['static'])
        ->and($images['support']['own'])->toBeFalse();
});

test('message templates only accept the allowed variables', function () {
    $admin = User::factory()->superuser()->create();

    $this->actingAs($admin)->post(route('admin.mascot-messages.store'), [
        'state' => 'idle', 'template' => 'Hola {nombre}, tu saldo es {saldo_total}', 'active' => true,
    ])->assertSessionHasErrors('template');

    $this->actingAs($admin)->post(route('admin.mascot-messages.store'), [
        'state' => 'idle', 'template' => 'Hola {nombre}, aquí está {mascota}.', 'active' => true,
    ])->assertSessionHasNoErrors();

    expect((new MessageRenderer)->render('Hola {nombre}{otra}.', ['nombre' => 'Ana']))->toBe('Hola Ana.');
});

test('regular users cannot manage the mascot catalog', function () {
    $mascot = Mascot::first();

    $this->actingAs($this->user)->get(route('admin.mascots.index'))->assertForbidden();
    $this->actingAs($this->user)->post(route('admin.mascots.archive', $mascot))->assertForbidden();
    $this->actingAs($this->user)->post(route('admin.mascot-messages.store'), ['state' => 'idle', 'template' => 'x'])->assertForbidden();
});

test('all mood states have a label and the required ones are cover and idle', function () {
    expect(collect(MascotState::cases())->filter->isRequired()->map->value->values()->all())->toBe(['cover', 'idle']);
});
