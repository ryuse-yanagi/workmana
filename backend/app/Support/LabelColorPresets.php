<?php

namespace App\Support;

class LabelColorPresets
{
    public const COUNT = 30;

    public const DEFAULT_INDEX = 5;

    /** @var list<string> マイグレーション用: color_index 導入前のプリセット HEX */
    public const LEGACY_HEX = [
        '#baf3db',
        '#fef3b0',
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

    public static function indexFromLegacyHex(string $hex): int
    {
        $normalized = strtolower(trim($hex));

        foreach (self::LEGACY_HEX as $index => $legacy) {
            if (strtolower($legacy) === $normalized) {
                return $index;
            }
        }

        return self::DEFAULT_INDEX;
    }
}
