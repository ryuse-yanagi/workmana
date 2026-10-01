<?php

namespace App\Support;

use App\Support\Workspace\BoardListColors;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class DefaultNamedColorItems
{
    /**
     * null は既定値にし、空や長すぎる名前は捨て、色は範囲外なら並び位置の既定にする。
     *
     * @param  list<array{name: string, color_index: int}>  $defaultItems
     * @param  list<mixed>|null  $raw
     * @return list<array{name: string, color_index: int}>
     */
    public static function normalize(?array $raw, array $defaultItems, int $maxNameLength = FieldLengthLimits::LIST_NAME): array
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
                if (mb_strlen($name) > $maxNameLength) {
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
            if (mb_strlen($name) > $maxNameLength) {
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

    /**
     * 同名は維持し、消えた名前の同じ位置に新しい名前があればリネーム、なければ削除とみなす。
     *
     * @param  list<array{name: string, color_index: int}>  $oldItems
     * @param  list<array{name: string, color_index: int}>  $newItems
     * @return array{
     *     renames: list<array{from: string, to: string}>,
     *     deleted: list<string>
     * }
     */
    public static function diffNameChanges(array $oldItems, array $newItems): array
    {
        $oldNameSet = [];
        foreach (self::names($oldItems) as $name) {
            $oldNameSet[$name] = true;
        }
        $newNameSet = [];
        foreach (self::names($newItems) as $name) {
            $newNameSet[$name] = true;
        }

        $renames = [];
        $deleted = [];
        $pairedNewNames = [];

        foreach ($oldItems as $index => $oldItem) {
            $oldName = $oldItem['name'];
            if (isset($newNameSet[$oldName])) {
                continue;
            }

            $newName = $newItems[$index]['name'] ?? null;
            if (
                is_string($newName)
                && $newName !== ''
                && ! isset($oldNameSet[$newName])
                && ! isset($pairedNewNames[$newName])
            ) {
                $renames[] = ['from' => $oldName, 'to' => $newName];
                $pairedNewNames[$newName] = true;

                continue;
            }

            $deleted[] = $oldName;
        }

        return [
            'renames' => $renames,
            'deleted' => $deleted,
        ];
    }

    /**
     * 連鎖して名前が衝突しないようリネームし、消えた名前は null にする。
     *
     * @param  Builder<Model>|\Illuminate\Database\Query\Builder  $query
     * @param  array{
     *     renames: list<array{from: string, to: string}>,
     *     deleted: list<string>
     * }  $diff
     */
    public static function syncStoredNames($query, string $column, array $diff): void
    {
        $renames = $diff['renames'] ?? [];
        $deleted = $diff['deleted'] ?? [];
        if ($renames === [] && $deleted === []) {
            return;
        }

        $temps = [];
        foreach ($renames as $index => $rename) {
            $from = $rename['from'] ?? null;
            $to = $rename['to'] ?? null;
            if (! is_string($from) || $from === '' || ! is_string($to) || $to === '' || $from === $to) {
                continue;
            }
            $temp = '__wm_rename_tmp_'.$index.'_'.bin2hex(random_bytes(8)).'__';
            $temps[] = ['temp' => $temp, 'to' => $to];
            (clone $query)->where($column, $from)->update([$column => $temp]);
        }

        foreach ($temps as $step) {
            (clone $query)->where($column, $step['temp'])->update([$column => $step['to']]);
        }

        foreach ($deleted as $name) {
            if (! is_string($name) || $name === '') {
                continue;
            }
            (clone $query)->where($column, $name)->update([$column => null]);
        }
    }

    /** 範囲外の色インデックスは、並び位置から決まる既定色にする。 */
    public static function sanitizeColorIndex(int $colorIndex, int $itemIndex): int
    {
        if (BoardListColors::isValidIndex($colorIndex)) {
            return $colorIndex;
        }

        return BoardListColors::defaultForIndex($itemIndex);
    }
}
