<?php

use App\Support\Money;
use Tests\TestCase;

uses(TestCase::class);

test('decimal text is converted to minor units without floats', function (string $input, string $currency, int $expected) {
    expect(Money::toMinor($input, $currency))->toBe($expected);
})->with([
    ['1234.56', 'EUR', 123456],
    ['1234,5', 'EUR', 123450],
    ['0.01', 'EUR', 1],
    ['0.1', 'EUR', 10],
    ['1 234.56', 'EUR', 123456],
    ['1234', 'CLP', 1234],
    ['9999999999999.99', 'EUR', 999999999999999],
]);

test('invalid amounts are rejected', function (string $input, string $currency) {
    Money::toMinor($input, $currency);
})->with([
    ['1.234,56', 'EUR'],
    ['12.345', 'EUR'],
    ['12.5', 'CLP'],
    ['abc', 'EUR'],
    ['', 'EUR'],
    ['-5', 'EUR'],
    ['1e5', 'EUR'],
])->throws(InvalidArgumentException::class);

test('negative amounts are accepted only when allowed', function () {
    expect(Money::toMinor('-85.5', 'EUR', allowNegative: true))->toBe(-8550);
});

test('minor units are converted back to decimal text', function (int $minor, string $currency, string $expected) {
    expect(Money::toDecimal($minor, $currency))->toBe($expected);
})->with([
    [123456, 'EUR', '1234.56'],
    [5, 'EUR', '0.05'],
    [0, 'EUR', '0.00'],
    [-8550, 'EUR', '-85.50'],
    [1234, 'CLP', '1234'],
]);
