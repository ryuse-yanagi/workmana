<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Project;

class DefaultBoardLists
{
    /** @var list<string> */
    public const DEFAULT_NAMES = ['未着手', '進行中', '完了'];

    /**
     * @return list<string>
     */
    public static function namesForOrganization(Organization $organization): array
    {
        $raw = $organization->default_board_list_names;

        return self::normalizeNames(is_array($raw) ? $raw : null);
    }

    /**
     * @param  list<string>|null  $names
     * @return list<string>
     */
    public static function normalizeNames(?array $names): array
    {
        if ($names === null) {
            return self::DEFAULT_NAMES;
        }

        $result = [];
        foreach ($names as $name) {
            if (! is_string($name)) {
                continue;
            }
            $trimmed = trim($name);
            if ($trimmed !== '') {
                $result[] = $trimmed;
            }
        }

        return $result;
    }

    public static function seedForProject(Project $project, Organization $organization): void
    {
        foreach (self::namesForOrganization($organization) as $index => $name) {
            $project->lists()->create([
                'name' => $name,
                'color' => BoardListColors::defaultForIndex($index),
                'sort_order' => $index,
            ]);
        }
    }
}
