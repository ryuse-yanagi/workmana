<?php

namespace App\Support\Workspace;

use App\Models\Organization\Organization;
use App\Models\Workspace\Workspace;
use App\Support\DefaultNamedColorItems;
use App\Support\SharedJson;

class DefaultBoardLists
{
    /**
     * 組織未設定時のフォールバック（正本: shared/default-named-color-items.json）。
     *
     * @return list<array{name: string, color_index: int}>
     */
    public static function defaultItems(): array
    {
        /** @var list<array{name: string, color_index: int}> $items */
        $items = SharedJson::load('default-named-color-items.json')['boardLists'];

        return $items;
    }

    /**
     * @return list<string>
     */
    public static function defaultNames(): array
    {
        return DefaultNamedColorItems::names(self::defaultItems());
    }

    /**
     * @return list<array{name: string, color_index: int}>
     */
    public static function itemsForOrganization(Organization $organization): array
    {
        $raw = $organization->default_board_list_names;

        return self::normalizeItems(is_array($raw) ? $raw : null);
    }

    /**
     * @return list<string>
     */
    public static function namesForOrganization(Organization $organization): array
    {
        return DefaultNamedColorItems::names(self::itemsForOrganization($organization));
    }

    /**
     * @param  list<mixed>|null  $raw
     * @return list<array{name: string, color_index: int}>
     */
    public static function normalizeItems(?array $raw): array
    {
        return DefaultNamedColorItems::normalize($raw, self::defaultItems());
    }

    /** 組織の既定ボード列で、そのスペースの列を作る。 */
    public static function seedForWorkspace(Workspace $workspace, Organization $organization): void
    {
        foreach (self::itemsForOrganization($organization) as $index => $item) {
            $workspace->lists()->create([
                'name' => $item['name'],
                'color_index' => $item['color_index'],
                'sort_order' => $index,
            ]);
        }
    }
}
