<?php

namespace App\Support\Workspace;

use App\Support\SharedJson;

class BoardListColors
{
    public const STANDARD_COUNT = 10;

    public const DEFAULT_INDEX = 0;

    /**
     * 移行期のボード列色。正本は shared/color-presets.json。
     *
     * @return list<string>
     */
    public static function legacyStandardHex(): array
    {
        /** @var list<string> $hex */
        $hex = SharedJson::load('color-presets.json')['legacyStandardHex'];

        return $hex;
    }

    /** @deprecated legacyStandardHex() を使う。 */
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
