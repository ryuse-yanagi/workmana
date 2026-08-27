<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

final class ListQuery
{
    /**
     * @param  list<string>  $searchColumns
     * @return array{page: int, per_page: int, q: string}
     */
    public static function params(Request $request, int $defaultPerPage = 50, int $maxPerPage = 100): array
    {
        $perPage = (int) $request->query('per_page', $defaultPerPage);
        $perPage = max(1, min($maxPerPage, $perPage));
        $page = max(1, (int) $request->query('page', 1));
        $q = trim((string) $request->query('q', ''));

        return [
            'page' => $page,
            'per_page' => $perPage,
            'q' => $q,
        ];
    }

    /**
     * @param  list<string>  $columns
     */
    public static function applySearch(Builder $query, string $q, array $columns): void
    {
        if ($q === '' || $columns === []) {
            return;
        }

        $like = '%'.mb_strtolower($q).'%';
        $query->where(function (Builder $inner) use ($like, $columns) {
            foreach ($columns as $index => $column) {
                $sql = 'LOWER('.$column.') LIKE ?';
                if ($index === 0) {
                    $inner->whereRaw($sql, [$like]);
                } else {
                    $inner->orWhereRaw($sql, [$like]);
                }
            }
        });
    }

    /**
     * 検索を適用しつつ全件を返す（1ページ表示用）。
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     * @param  Builder<TModel>  $query
     * @param  callable(TModel): mixed  $map
     * @param  list<string>  $searchColumns
     * @return array{data: list<mixed>, meta: array{page: int, per_page: int, total: int, last_page: int, q: string}}
     */
    public static function all(Builder $query, Request $request, callable $map, array $searchColumns = []): array
    {
        $q = trim((string) $request->query('q', ''));
        self::applySearch($query, $q, $searchColumns);

        $items = $query
            ->get()
            ->map($map)
            ->values()
            ->all();
        $total = count($items);

        return [
            'data' => $items,
            'meta' => [
                'page' => 1,
                'per_page' => $total,
                'total' => $total,
                'last_page' => 1,
                'q' => $q,
            ],
        ];
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     * @param  Builder<TModel>  $query
     * @param  callable(TModel): mixed  $map
     * @return array{data: list<mixed>, meta: array{page: int, per_page: int, total: int, last_page: int, q: string}}
     */
    public static function paginate(Builder $query, Request $request, callable $map, array $searchColumns = [], int $defaultPerPage = 50): array
    {
        $params = self::params($request, $defaultPerPage);
        self::applySearch($query, $params['q'], $searchColumns);

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $params['per_page']));
        $page = min($params['page'], $lastPage);

        $items = $query
            ->forPage($page, $params['per_page'])
            ->get()
            ->map($map)
            ->values()
            ->all();

        return [
            'data' => $items,
            'meta' => [
                'page' => $page,
                'per_page' => $params['per_page'],
                'total' => $total,
                'last_page' => $lastPage,
                'q' => $params['q'],
            ],
        ];
    }
}
