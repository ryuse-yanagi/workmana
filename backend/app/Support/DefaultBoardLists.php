<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Workspace;

class DefaultBoardLists
{
    /**
     * @return list<array{name: string, color_index: int}>
     */
    public static function defaultItems(): array
    {
        /** @var list<array{name: string, color_index: int}> $items */
        $items = SharedJson::load('default-named-color-items.json')['boardLists'];

        return $items;
    }

    public static function maxItems(): int
    {
        return (int) SharedJson::load('default-named-color-items.json')['maxItems'];
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
