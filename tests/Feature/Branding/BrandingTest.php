<?php

use App\Branding\Brand;
use App\Media\IconGenerator;
use App\Media\ImageInspector;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');
    app(Brand::class)->forget();
    $this->admin = User::factory()->superuser()->create();
});

/** PNG de prueba generado con GD (opaco o transparente). */
function pngBytes(int $width, int $height, bool $opaque = true): string
{
    $image = imagecreatetruecolor($width, $height);
    imagesavealpha($image, true);
    $color = $opaque ? imagecolorallocate($image, 15, 118, 110) : imagecolorallocatealpha($image, 0, 0, 0, 127);
    imagefill($image, 0, 0, $color);
    ob_start();
    imagepng($image);

    return (string) ob_get_clean();
}

function upload(string $name, string $bytes): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $bytes);
}

test('only superusers can manage the visual identity', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('admin.branding.edit'))->assertForbidden();
    $this->actingAs($user)->put(route('admin.branding.update'), ['name' => 'X'])->assertForbidden();
});

test('name and colors are saved and reach the manifest and the pages', function () {
    $this->actingAs($this->admin)->put(route('admin.branding.update'), [
        'name' => 'Mis Cuentas', 'short_name' => 'Cuentas', 'theme_color' => '#1d4ed8', 'background_color' => '#ffffff', 'primary_color' => '#1d4ed8',
    ])->assertSessionHasNoErrors();

    $this->get(route('manifest'))
        ->assertOk()
        ->assertHeader('Content-Type', 'application/manifest+json')
        ->assertJsonPath('name', 'Mis Cuentas')
        ->assertJsonPath('short_name', 'Cuentas')
        ->assertJsonPath('theme_color', '#1d4ed8')
        ->assertJsonPath('icons.2.purpose', 'maskable');

    auth()->logout();

    $this->get(route('login'))
        ->assertSee('<meta name="application-name" content="Mis Cuentas">', false)
        ->assertSee('--primary: #1d4ed8', false)
        ->assertInertia(fn (Assert $page) => $page->where('brand.name', 'Mis Cuentas'));
});

test('a primary color without enough contrast against white text is rejected', function () {
    $this->actingAs($this->admin)->put(route('admin.branding.update'), [
        'name' => 'X', 'short_name' => 'X', 'theme_color' => '#ffffff', 'background_color' => '#ffffff', 'primary_color' => '#7dd3fc',
    ])->assertSessionHasErrors('primary_color');
});

test('the original generates every icon with the right sizes', function () {
    $this->actingAs($this->admin)
        ->post(route('admin.branding.upload', 'source'), ['file' => upload('logo.png', pngBytes(1024, 1024, false))])
        ->assertSessionHasNoErrors();

    $urls = app(Brand::class)->resolved();
    foreach (['pwa_192', 'pwa_512', 'pwa_maskable', 'apple_touch', 'favicon_ico', 'logo_square'] as $key) {
        expect($urls['custom'][$key])->toBeTrue("{$key} no se generó");
    }

    $inspector = new ImageInspector;
    $files = collect(Storage::disk('public')->allFiles('brand'))->map(fn ($path) => $inspector->inspect(Storage::disk('public')->get($path)));

    expect($files->pluck('width')->filter()->unique()->sort()->values()->all())->toContain(180, 192, 512)
        ->and($files->firstWhere('mime', 'image/x-icon')['sizes'])->toBe([16, 32, 48]);
});

test('the generated maskable icon is opaque and apple icon has no transparency', function () {
    $icons = app(IconGenerator::class)->fromSource(pngBytes(1024, 1024, false), '#0f766e');
    $inspector = new ImageInspector;

    expect($inspector->inspect($icons['pwa_maskable'])['opaque_corners'])->toBeTrue()
        ->and($inspector->inspect($icons['apple_touch'])['opaque_corners'])->toBeTrue()
        ->and($inspector->inspect($icons['pwa_192'])['width'])->toBe(192);
});

test('uploads are validated by their real content, size and dimensions', function () {
    $this->actingAs($this->admin);

    // Texto con extensión .png.
    $this->post(route('admin.branding.upload', 'pwa_192'), ['file' => upload('fake.png', 'no soy una imagen')])
        ->assertSessionHasErrors('file');

    // Medidas incorrectas.
    $this->post(route('admin.branding.upload', 'pwa_192'), ['file' => upload('icon.png', pngBytes(200, 200))])
        ->assertSessionHasErrors('file');

    // Maskable con esquinas transparentes.
    $this->post(route('admin.branding.upload', 'pwa_maskable'), ['file' => upload('m.png', pngBytes(512, 512, false))])
        ->assertSessionHasErrors('file');

    // Original no cuadrado.
    $this->post(route('admin.branding.upload', 'source'), ['file' => upload('s.png', pngBytes(1024, 600))])
        ->assertSessionHasErrors('file');

    // Recurso inexistente.
    $this->post(route('admin.branding.upload', 'cualquiera'), ['file' => upload('x.png', pngBytes(10, 10))])
        ->assertNotFound();

    $this->post(route('admin.branding.upload', 'pwa_192'), ['file' => upload('ok.png', pngBytes(192, 192))])
        ->assertSessionHasNoErrors();
});

test('uploaded SVGs are sanitized', function () {
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script>'
        .'<a href="javascript:alert(3)"><rect width="10" height="10" fill="#0f766e"/></a>'
        .'<image href="https://malo.example/x.png"/><rect width="5" height="5" style="fill:red"/></svg>';

    $this->actingAs($this->admin)
        ->post(route('admin.branding.upload', 'logo'), ['file' => upload('logo.svg', $svg)])
        ->assertSessionHasNoErrors();

    $stored = Storage::disk('public')->get(collect(Storage::disk('public')->allFiles('brand'))->first());

    expect($stored)->not->toContain('script')
        ->not->toContain('onload')
        ->not->toContain('javascript:')
        ->not->toContain('malo.example')
        ->toContain('<rect');

    $this->actingAs($this->admin)
        ->post(route('admin.branding.upload', 'logo'), ['file' => upload('x.svg', '<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>')])
        ->assertSessionHasErrors('file');
});

test('an asset can go back to its default', function () {
    $this->actingAs($this->admin)->post(route('admin.branding.upload', 'pwa_192'), ['file' => upload('ok.png', pngBytes(192, 192))]);
    expect(app(Brand::class)->resolved()['custom']['pwa_192'])->toBeTrue();

    $this->actingAs($this->admin)->delete(route('admin.branding.reset', 'pwa_192'))->assertSessionHasNoErrors();

    $brand = app(Brand::class)->resolved();
    expect($brand['custom']['pwa_192'])->toBeFalse()
        ->and($brand['urls']['pwa_192'])->toEndWith('brand/pwa-192.png');
});
