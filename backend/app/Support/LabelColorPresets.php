<?php

namespace App\Support;

class LabelColorPresets
{
    public const COUNT = 30;

    public const DEFAULT_INDEX = 5;

    /**
     * 移行期のラベル色。正本は shared/color-presets.json。
     *
     * @return list<string>
     */
    public static function legacyHex(): array
    {
        /** @var list<string> $hex */
        $hex = SharedJson::load('color-presets.json')['legacyPresets'];

        return $hex;
    }

    /** @deprecated legacyHex() を使う。 */
    public const LEGACY_HEX = [
        '#baf3db',
        '#fff4cc',
        '#fce4a6',
        '#ffd5d2',
        '#eed7fc',
        '#4bce97',
        '#ffe600',
        '#fea72f',
        '#ff624d',
        '#c883e2',
        '#1f845a',
        '#b89400',
        '#c56f0a',
        '#eb1f00',
        '#9e49c5',
        '#cfe1fd',
        '#c6edfb',
        '#d3f1a7',
        '#f8c2e4',
        '#dddee1',
        '#669df1',
        '#6cc3e0',
        '#94c748',
        '#fe84cf',
        '#8c8f97',
        '#1868db',
        '#227d9b',
        '#5b7f24',
        '#b8367d',
        '#6b6e76',
    ];

    public static function isValidIndex(int $index): bool
    {
        return $index >= 0 && $index < self::COUNT;
    }

    public static function assertMatchesSharedJson(): void
    {
        $json = SharedJson::load('color-presets.json');
        $presets = $json['presets'] ?? null;
        if (! is_array($presets) || count($presets) !== self::COUNT) {
            throw new \RuntimeException('LabelColorPresets::COUNT does not match shared/color-presets.json presets length');
        }
        if ((int) ($json['defaultPresetIndex'] ?? -1) !== self::DEFAULT_INDEX) {
            throw new \RuntimeException('LabelColorPresets::DEFAULT_INDEX does not match shared/color-presets.json');
        }
        if (self::legacyHex() !== self::LEGACY_HEX) {
            throw new \RuntimeException('LabelColorPresets::LEGACY_HEX does not match shared/color-presets.json legacyPresets');
        }
    }
}
