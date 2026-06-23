<?php

namespace App\Support;

class BoardListColors
{
    /** @var list<string> */
    public const STANDARD = [
        '#4bce97',
        '#ffe600',
        '#fea72f',
        '#ff624d',
        '#c883e2',
        '#669df1',
        '#6cc3e0',
        '#61e9a1',
        '#fe84cf',
        '#8c8f97',
    ];

    public const DEFAULT = '#4bce97';

    public static function isStandard(string $color): bool
    {
        $normalized = strtolower($color);

        foreach (self::STANDARD as $standardColor) {
            if (strtolower($standardColor) === $normalized) {
                return true;
            }
        }

        return false;
    }

    public static function defaultForIndex(int $index): string
    {
        $colors = self::STANDARD;

        return $colors[$index % count($colors)];
    }
}
