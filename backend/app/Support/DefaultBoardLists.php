<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Workspace;

class DefaultBoardLists
{
    /** @var list<array{name: string, color_index: int}> */
    public const DEFAULT_ITEMS = [
        ['name' => '未着手', 'color_index' => 0],
        ['name' => '進行中', 'color_index' => 1],
        ['name' => '完了', 'color_index' => 3],
    ];

    /** @var list<string> */
    public const DEFAULT_NAMES = ['未着手', '進行中', '完了'];

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
        return DefaultNamedColorItems::normalize($raw, self::DEFAULT_ITEMS);
    }

    /**
     * @param  list<mixed>|null  $names
     * @return list<string>
     * @deprecated Use normalizeItems() for color-aware settings.
     */
    public static function normalizeNames(?array $names): array
    {
        return DefaultNamedColorItems::names(self::normalizeItems($names));
    }

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
