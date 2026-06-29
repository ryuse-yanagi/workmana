<?php

namespace Database\Seeders;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Support\DefaultBoardLists;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    /** @var list<string> */
    private const WORKSPACE_NAMES = ['dmy_ws_a', 'dmy_ws_b', 'dmy_ws_c'];

    /** @var list<string> */
    private const WORKSPACE_SUFFIXES = ['a', 'b', 'c'];

    public function run (): void
    {
        $org = Organization::query()->where('slug', OrganizationSeeder::SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.OrganizationSeeder::SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $reporter = User::query()->where('name', 'dmy_user_1')->first();
        if ($reporter === null) {
            $this->command?->warn('dmy_user_1 not found. Run UserSeeder first.');

            return;
        }

        foreach (self::WORKSPACE_NAMES as $index => $workspaceName) {
            $workspace = Workspace::query()
                ->where('organization_id', $org->id)
                ->where('name', $workspaceName)
                ->first();

            if ($workspace === null) {
                $this->command?->warn("Workspace \"{$workspaceName}\" not found. Run WorkspaceSeeder first.");

                continue;
            }

            $this->seedTasksForWorkspace($org, $workspace, $reporter, self::WORKSPACE_SUFFIXES[$index]);
        }
    }

    private function seedTasksForWorkspace (
        Organization $org,
        Workspace $workspace,
        User $reporter,
        string $suffix,
    ): void {
        $listsByName = $this->resolveDefaultLists($workspace);
        $parents = [];

        for ($parentIndex = 1; $parentIndex <= 3; $parentIndex++) {
            $listName = DefaultBoardLists::DEFAULT_NAMES[$parentIndex - 1];
            $list = $listsByName[$listName] ?? null;
            if ($list === null) {
                $this->command?->warn("List \"{$listName}\" not found in workspace \"{$workspace->name}\".");

                continue;
            }

            $title = "dmy_p_task_{$suffix}_{$parentIndex}";
            $parents[$parentIndex] = Task::query()->firstOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'title' => $title,
                ],
                [
                    'organization_id' => $org->id,
                    'list_id' => $list->id,
                    'sort_order' => 0,
                    'is_parent_task' => true,
                    'parent_task_id' => null,
                    'description' => null,
                    'status' => TaskStatus::Todo->value,
                    'priority' => TaskPriority::Medium->value,
                    'reporter_id' => $reporter->id,
                ],
            );
        }

        for ($childIndex = 1; $childIndex <= 9; $childIndex++) {
            $parentIndex = (int) ceil($childIndex / 3);
            $parent = $parents[$parentIndex] ?? null;
            if ($parent === null) {
                continue;
            }

            $childOrderInList = (($childIndex - 1) % 3) + 1;
            $title = "dmy_task_{$suffix}_{$childIndex}";

            Task::query()->firstOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'title' => $title,
                ],
                [
                    'organization_id' => $org->id,
                    'list_id' => $parent->list_id,
                    'sort_order' => $childOrderInList,
                    'is_parent_task' => false,
                    'parent_task_id' => $parent->id,
                    'description' => null,
                    'status' => TaskStatus::Todo->value,
                    'priority' => TaskPriority::Medium->value,
                    'reporter_id' => $reporter->id,
                ],
            );
        }
    }

    /**
     * @return array<string, BoardList>
     */
    private function resolveDefaultLists (Workspace $workspace): array
    {
        $lists = $workspace->lists()
            ->whereIn('name', DefaultBoardLists::DEFAULT_NAMES)
            ->orderBy('sort_order')
            ->get();

        $byName = [];
        foreach ($lists as $list) {
            $byName[$list->name] = $list;
        }

        return $byName;
    }
}
