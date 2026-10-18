<?php

namespace App\Support;

use App\Exceptions\ConflictException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SortOrderReorder
{
    /**
     * 順序は見ず、ID の集合が期待と違うときは検証エラーにする。
     *
     * @param  list<int>  $orderedIds
     * @param  list<int>  $expectedIds
     */
    public static function assertExactIdSet(array $orderedIds, array $expectedIds, string $field, string $message): void
    {
        $sortedIncoming = $orderedIds;
        sort($sortedIncoming);
        $sortedExpected = $expectedIds;
        sort($sortedExpected);

        if ($sortedIncoming !== $sortedExpected) {
            throw ValidationException::withMessages([$field => $message]);
        }
    }

    /**
     * 渡した ID の順で sort_order を振り、スコープ外の行は更新しない。
     *
     * @param  Builder<Model>  $scopedQuery
     * @param  list<int>  $orderedIds
     */
    public static function apply(Builder $scopedQuery, array $orderedIds): void
    {
        DB::transaction(function () use ($scopedQuery, $orderedIds) {
            $lockedIds = (clone $scopedQuery)
                ->whereIn('id', $orderedIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
            sort($lockedIds);
            $expected = $orderedIds;
            sort($expected);
            if ($lockedIds !== $expected) {
                throw new ConflictException('他の操作と重なったため、もう一度お試しください。');
            }

            foreach ($orderedIds as $index => $id) {
                (clone $scopedQuery)
                    ->where('id', $id)
                    ->update(['sort_order' => $index]);
            }
        });
    }
}
