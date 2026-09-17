<?php

namespace App\Support;

class BoardListColors
{
    public const STANDARD_COUNT = 10;

    public const DEFAULT_INDEX = 0;

    /**
     * @return list<string>
     */
    public static function legacyStandardHex(): array
    {
        /** @var list<string> $hex */
        $hex = SharedJson::load('color-presets.json')['legacyStandardHex'];

        return $hex;
    }

    /** @deprecated Use legacyStandardHex() */
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

    /** @deprecated 既存マイグレーション互換用 */
    public const DEFAULT = self::LEGACY_STANDARD_HEX[0];

    public static function isValidIndex(int $index): bool
    {
        return $index >= 0 && $index < self::STANDARD_COUNT;
    }

    public static function indexFromLegacyHex(string $hex): int
    {
        $normalized = strtolower(trim($hex));

        foreach (self::legacyStandardHex() as $index => $legacy) {
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

    public static function assertMatchesSharedJson(): void
    {
        if (self::legacyStandardHex() !== self::LEGACY_STANDARD_HEX) {
            throw new \RuntimeException('BoardListColors::LEGACY_STANDARD_HEX does not match shared/color-presets.json');
        }
        if (count(self::legacyStandardHex()) !== self::STANDARD_COUNT) {
            throw new \RuntimeException('BoardListColors::STANDARD_COUNT does not match shared legacyStandardHex length');
        }
    }
}
