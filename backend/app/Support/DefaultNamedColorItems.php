<?php

namespace App\Support;

class DefaultNamedColorItems
{
    /**
     * @param  list<array{name: string, color_index: int}>  $defaultItems
     * @param  list<mixed>|null  $raw
     * @return list<array{name: string, color_index: int}>
     */
    public static function normalize(?array $raw, array $defaultItems): array
    {
        if ($raw === null) {
            return $defaultItems;
        }

        $result = [];
        foreach ($raw as $index => $entry) {
            if (is_string($entry)) {
                $name = trim($entry);
                if ($name === '') {
                    continue;
                }
                if (mb_strlen($name) > FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME) {
                    continue;
                }
                $fallback = $defaultItems[$index] ?? null;
                $colorIndex = $fallback !== null
                    ? (int) $fallback['color_index']
                    : BoardListColors::defaultForIndex(count($result));
                $result[] = [
                    'name' => $name,
                    'color_index' => self::sanitizeColorIndex($colorIndex, count($result)),
                ];

                continue;
            }

            if (! is_array($entry)) {
                continue;
            }

            $name = trim((string) ($entry['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            if (mb_strlen($name) > FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME) {
                continue;
            }

            $colorIndex = array_key_exists('color_index', $entry)
                ? (int) $entry['color_index']
                : (int) (($defaultItems[$index]['color_index'] ?? BoardListColors::defaultForIndex(count($result))));

            $result[] = [
                'name' => $name,
                'color_index' => self::sanitizeColorIndex($colorIndex, count($result)),
            ];
        }

        return $result;
    }

    /**
     * @param  list<array{name: string, color_index: int}>  $items
     * @return list<string>
     */
    public static function names(array $items): array
    {
        return array_values(array_map(fn (array $item) => $item['name'], $items));
    }

    /**
     * @param  list<array{name: string, color_index: int}>  $items
     */
    public static function findItemByName(array $items, string $name): ?array
    {
        foreach ($items as $item) {
            if ($item['name'] === $name) {
                return $item;
            }
        }

        return null;
    }

    public static function sanitizeColorIndex(int $colorIndex, int $itemIndex): int
    {
        if (BoardListColors::isValidIndex($colorIndex)) {
            return $colorIndex;
        }

        return BoardListColors::defaultForIndex($itemIndex);
    }
}
