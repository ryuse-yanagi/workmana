<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\TaskLabel;
use App\Models\TaskLabelCategory;
use App\Models\User;
use App\Models\WorkspaceLabel;
use App\Models\WorkspaceLabelCategory;
use Illuminate\Database\Seeder;

class LabelSeeder extends Seeder
{
    /** @var list<string> */
    private const WORKSPACE_CATEGORY_NAMES = ['dmy_ctg_ws_a', 'dmy_ctg_ws_b'];

    /** @var list<string> */
    private const TASK_CATEGORY_NAMES = ['dmy_ctg_task_a', 'dmy_ctg_task_b'];

    /**
     * 標準色プリセット index: 赤 #ff624d, 青 #669df1, 黄 #ffe600, 緑 #4bce97
     *
     * @var list<int>
     */
    private const LABEL_COLOR_INDICES = [8, 20, 6, 5];

    /** @var list<array{category: string, name: string}> */
    private const WORKSPACE_LABELS = [
        ['category' => 'dmy_ctg_ws_a', 'name' => 'dmy_label_ws_a_1'],
        ['category' => 'dmy_ctg_ws_a', 'name' => 'dmy_label_ws_a_2'],
        ['category' => 'dmy_ctg_ws_b', 'name' => 'dmy_label_ws_b_1'],
        ['category' => 'dmy_ctg_ws_b', 'name' => 'dmy_label_ws_b_2'],
    ];

    /** @var list<array{category: string, name: string}> */
    private const TASK_LABELS = [
        ['category' => 'dmy_ctg_task_a', 'name' => 'dmy_label_task_a_1'],
        ['category' => 'dmy_ctg_task_a', 'name' => 'dmy_label_task_a_2'],
        ['category' => 'dmy_ctg_task_b', 'name' => 'dmy_label_task_b_1'],
        ['category' => 'dmy_ctg_task_b', 'name' => 'dmy_label_task_b_2'],
    ];

    public function run (): void
    {
        $org = Organization::query()->where('slug', OrganizationSeeder::SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.OrganizationSeeder::SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $creator = User::query()->where('name', 'dmy_user_01')->first();
        if ($creator === null) {
            $this->command?->warn('dmy_user_01 not found. Run UserSeeder first.');

            return;
        }

        $this->seedWorkspaceLabels($org, $creator);
        $this->seedTaskLabels($org, $creator);
    }

    private function seedWorkspaceLabels (Organization $org, User $creator): void
    {
        $categoriesByName = $this->seedCategories(
            WorkspaceLabelCategory::class,
            $org,
            $creator,
            self::WORKSPACE_CATEGORY_NAMES,
        );

        foreach (self::WORKSPACE_LABELS as $index => $definition) {
            $category = $categoriesByName[$definition['category']] ?? null;
            if ($category === null) {
                continue;
            }

            WorkspaceLabel::query()->updateOrCreate(
                [
                    'category_id' => $category->id,
                    'name' => $definition['name'],
                ],
                [
                    'organization_id' => $org->id,
                    'created_by' => $creator->id,
                    'color_index' => self::LABEL_COLOR_INDICES[$index],
                    'sort_order' => $index,
                ],
            );
        }
    }

    private function seedTaskLabels (Organization $org, User $creator): void
    {
        $categoriesByName = $this->seedCategories(
            TaskLabelCategory::class,
            $org,
            $creator,
            self::TASK_CATEGORY_NAMES,
        );

        foreach (self::TASK_LABELS as $index => $definition) {
            $category = $categoriesByName[$definition['category']] ?? null;
            if ($category === null) {
                continue;
            }

            TaskLabel::query()->updateOrCreate(
                [
                    'category_id' => $category->id,
                    'name' => $definition['name'],
                ],
                [
                    'organization_id' => $org->id,
                    'created_by' => $creator->id,
                    'color_index' => self::LABEL_COLOR_INDICES[$index],
                    'sort_order' => $index,
                ],
            );
        }
    }

    /**
     * @param  class-string<WorkspaceLabelCategory|TaskLabelCategory>  $modelClass
     * @return array<string, WorkspaceLabelCategory|TaskLabelCategory>
     */
    private function seedCategories (string $modelClass, Organization $org, User $creator, array $categoryNames): array
    {
        $byName = [];

        foreach ($categoryNames as $sortOrder => $name) {
            $byName[$name] = $modelClass::query()->firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name' => $name,
                ],
                [
                    'created_by' => $creator->id,
                    'sort_order' => $sortOrder,
                ],
            );
        }

        return $byName;
    }
}
