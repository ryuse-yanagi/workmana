<?php

namespace Database\Seeders;

use App\Models\Organization\Organization;
use App\Models\Task\TaskLabel;
use App\Models\Task\TaskLabelCategory;
use App\Models\User;
use App\Models\Workspace\WorkspaceLabel;
use App\Models\Workspace\WorkspaceLabelCategory;
use Illuminate\Database\Seeder;

class LabelSeeder extends Seeder
{
    public function run(): void
    {
        $org = DummySeederData::seededOrganization();
        if ($org === null) {
            $this->command?->warn('Organization "'.DummySeederData::ORG_NAME.'" not found. Run OrganizationSeeder first.');

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
    private function seedLabels(
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
