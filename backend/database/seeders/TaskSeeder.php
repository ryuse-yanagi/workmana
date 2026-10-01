<?php

namespace Database\Seeders;

use App\Enums\TaskPriority;
use App\Models\Organization\Organization;
use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use App\Support\Workspace\DefaultBoardLists;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    public function run(): void
    {
        $org = DummySeederData::seededOrganization();
        if ($org === null) {
            $this->command?->warn('Organization "'.DummySeederData::ORG_NAME.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $reporter = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($reporter === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        $workspace = Workspace::query()
            ->where('organization_id', $org->id)
            ->where('name', DummySeederData::WORKSPACE_NAME)
            ->first();

        if ($workspace === null) {
            $this->command?->warn('Workspace "'.DummySeederData::WORKSPACE_NAME.'" not found. Run WorkspaceSeeder first.');

            return;
        }

        $this->seedTasksForWorkspace($org, $workspace, $reporter);
    }

    private function seedTasksForWorkspace(
        Organization $org,
        Workspace $workspace,
        User $reporter,
    ): void {
        $listsByName = $workspace->lists()
            ->whereIn('name', DefaultBoardLists::defaultNames())
            ->get()
            ->keyBy('name');

        foreach (DefaultBoardLists::defaultNames() as $listName) {
            if (! $listsByName->has($listName)) {
                $this->command?->warn(
                    'Board list "'.$listName.'" not found in workspace "'.DummySeederData::WORKSPACE_NAME.'".'
                );

                return;
            }
        }

        $parentSortOrder = 0;

        foreach (DummySeederData::taskTree() as $parentTitle => $childTitles) {
            $listName = DummySeederData::taskListNameForParent($parentTitle);
            /** @var BoardList $list */
            $list = $listsByName->get($listName);

            $parent = Task::query()->updateOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'title' => $parentTitle,
                ],
                [
                    'organization_id' => $org->id,
                    'list_id' => $list->id,
                    'sort_order' => $parentSortOrder,
                    'is_parent_task' => true,
                    'parent_task_id' => null,
                    'description' => null,
                    'priority' => TaskPriority::Medium->value,
                    'reporter_id' => $reporter->id,
                ],
            );

            foreach ($childTitles as $childSortOrder => $childTitle) {
                Task::query()->updateOrCreate(
                    [
                        'workspace_id' => $workspace->id,
                        'title' => $childTitle,
                        'parent_task_id' => $parent->id,
                    ],
                    [
                        'organization_id' => $org->id,
                        'list_id' => $list->id,
                        'sort_order' => $childSortOrder + 1,
                        'is_parent_task' => false,
                        'description' => null,
                        'priority' => TaskPriority::Medium->value,
                        'reporter_id' => $reporter->id,
                    ],
                );
            }

            $parentSortOrder++;
        }
    }
}
