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
    public function run (): void
    {
        $org = Organization::query()->where('slug', DummySeederData::ORG_SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.DummySeederData::ORG_SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $creator = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($creator === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        $this->seedLabels(
            WorkspaceLabelCategory::class,
            WorkspaceLabel::class,
            $org,
            $creator,
            DummySeederData::workspaceLabelsByCategory(),
        );
        $this->seedLabels(
            TaskLabelCategory::class,
            TaskLabel::class,
            $org,
            $creator,
            DummySeederData::taskLabelsByCategory(),
        );
    }

    /**
     * @param  class-string<WorkspaceLabelCategory|TaskLabelCategory>  $categoryModelClass
     * @param  class-string<WorkspaceLabel|TaskLabel>  $labelModelClass
     * @param  array<string, list<string>>  $labelsByCategory
     */
    private function seedLabels (
        string $categoryModelClass,
        string $labelModelClass,
        Organization $org,
        User $creator,
        array $labelsByCategory,
    ): void {
        $colorIndices = DummySeederData::LABEL_COLOR_INDICES;
        $globalLabelIndex = 0;

        foreach (array_keys($labelsByCategory) as $categorySortOrder => $categoryName) {
            $category = $categoryModelClass::query()->firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name' => $categoryName,
                ],
                [
                    'created_by' => $creator->id,
                    'sort_order' => $categorySortOrder,
                ],
            );

            foreach ($labelsByCategory[$categoryName] as $labelSortOrder => $labelName) {
                $labelModelClass::query()->updateOrCreate(
                    [
                        'category_id' => $category->id,
                        'name' => $labelName,
                    ],
                    [
                        'organization_id' => $org->id,
                        'created_by' => $creator->id,
                        'color_index' => $colorIndices[$globalLabelIndex % count($colorIndices)],
                        'sort_order' => $labelSortOrder,
                    ],
                );
                $globalLabelIndex++;
            }
        }
    }
}
