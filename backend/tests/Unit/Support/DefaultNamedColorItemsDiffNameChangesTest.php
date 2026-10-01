<?php

namespace Tests\Unit\Support;

use App\Support\DefaultNamedColorItems;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DefaultNamedColorItemsDiffNameChangesTest extends TestCase
{
    /**
     * @return array<string, array{0: list<array{name: string, color_index: int}>, 1: list<array{name: string, color_index: int}>, 2: list<array{from: string, to: string}>, 3: list<string>}>
     */
    public static function cases(): array
    {
        return [
            'reorder_only' => [
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B', 'color_index' => 1],
                    ['name' => 'C', 'color_index' => 2],
                ],
                [
                    ['name' => 'C', 'color_index' => 2],
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B', 'color_index' => 1],
                ],
                [],
                [],
            ],
            'color_only' => [
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B', 'color_index' => 1],
                ],
                [
                    ['name' => 'A', 'color_index' => 3],
                    ['name' => 'B', 'color_index' => 4],
                ],
                [],
                [],
            ],
            'single_rename' => [
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B', 'color_index' => 1],
                    ['name' => 'C', 'color_index' => 2],
                ],
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B2', 'color_index' => 1],
                    ['name' => 'C', 'color_index' => 2],
                ],
                [['from' => 'B', 'to' => 'B2']],
                [],
            ],
            'delete_middle' => [
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B', 'color_index' => 1],
                    ['name' => 'C', 'color_index' => 2],
                ],
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'C', 'color_index' => 2],
                ],
                [],
                ['B'],
            ],
            'add_only' => [
                [
                    ['name' => 'A', 'color_index' => 0],
                ],
                [
                    ['name' => 'A', 'color_index' => 0],
                    ['name' => 'B', 'color_index' => 1],
                ],
                [],
                [],
            ],
            'bulk_replace_pairs_by_index' => [
                [
                    ['name' => '準備中', 'color_index' => 1],
                    ['name' => '稼働中', 'color_index' => 0],
                    ['name' => '保留', 'color_index' => 3],
                    ['name' => '完了', 'color_index' => 5],
                ],
                [
                    ['name' => '計画中', 'color_index' => 2],
                    ['name' => '運用中', 'color_index' => 0],
                    ['name' => '停止', 'color_index' => 3],
                ],
                [
                    ['from' => '準備中', 'to' => '計画中'],
                    ['from' => '稼働中', 'to' => '運用中'],
                    ['from' => '保留', 'to' => '停止'],
                ],
                ['完了'],
            ],
        ];
    }

    /**
     * 名前変更と削除の差分を正しく検出する
     *
     * @param  list<array{name: string, color_index: int}>  $oldItems
     * @param  list<array{name: string, color_index: int}>  $newItems
     * @param  list<array{from: string, to: string}>  $renames
     * @param  list<string>  $deleted
     */
    #[DataProvider('cases')]
    public function test_diff_name_changes(
        array $oldItems,
        array $newItems,
        array $renames,
        array $deleted,
    ): void {
        $diff = DefaultNamedColorItems::diffNameChanges($oldItems, $newItems);

        $this->assertSame($renames, $diff['renames']);
        $this->assertSame($deleted, $diff['deleted']);
    }
}
