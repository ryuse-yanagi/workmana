<?php

namespace App\Support;

class BoardListColors
{
    public const STANDARD_COUNT = 10;

    public const DEFAULT_INDEX = 0;

    /** @deprecated 既存マイグレーション互換用 */
    public const DEFAULT = self::LEGACY_STANDARD_HEX[0];

    /** @var list<string> マイグレーション用: color_index 導入前の標準リスト色 HEX */
    public const LEGACY_STANDARD_HEX = [
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

    public static function isValidIndex(int $index): bool
    {
        return $index >= 0 && $index < self::STANDARD_COUNT;
    }

    public static function indexFromLegacyHex(string $hex): int
    {
        $normalized = strtolower(trim($hex));

        foreach (self::LEGACY_STANDARD_HEX as $index => $legacy) {
            if (strtolower($legacy) === $normalized) {
                return $index;
            }
        }

        return self::DEFAULT_INDEX;
    }

    public static function defaultForIndex(int $index): int
    {
        return $index % self::STANDARD_COUNT;
    }
}
