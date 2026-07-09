<?php

namespace Database\Seeders;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceLabel;
use App\Support\DefaultBoardLists;
use Illuminate\Database\Seeder;

class WorkspaceSeeder extends Seeder
{
    /**
     * @var array<string, array{description: string, labels: list<string>, assignee_numbers: list<int>}>
     */
    private const WORKSPACE_DEFINITIONS = [
        'dmy_ws_a' => [
            'description' => 'あいうえおかきくけこさしすせそ',
            'labels' => ['dmy_label_ws_a_1'],
            'assignee_numbers' => [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
        ],
        'dmy_ws_b' => [
            'description' => 'たちつてとなにぬねのはひふへほ',
            'labels' => ['dmy_label_ws_a_2'],
            'assignee_numbers' => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        ],
        'dmy_ws_c' => [
            'description' => 'まみむめもやゆよらりるれろわをん',
            'labels' => ['dmy_label_ws_b_1', 'dmy_label_ws_b_2'],
            'assignee_numbers' => [1, 2, 3, 4, 5, 11, 12, 13, 14, 15],
        ],
    ];

    public function run (): void
    {
        $org = Organization::query()->where('slug', OrganizationSeeder::SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.OrganizationSeeder::SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $admin = User::query()->where('name', 'dmy_user_01')->first();
        if ($admin === null) {
            $this->command?->warn('dmy_user_01 not found. Run UserSeeder first.');

            return;
        }

        $dummyUsers = User::query()
            ->where('name', 'like', 'dmy_user_%')
            ->orderBy('id')
            ->get();

        foreach (self::WORKSPACE_DEFINITIONS as $workspaceName => $definition) {
            $workspace = Workspace::query()->firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name' => $workspaceName,
                ],
                [
                    'created_by' => $admin->id,
                    'description' => $definition['description'],
                ],
            );

            if (! $workspace->wasRecentlyCreated) {
                $workspace->update(['description' => $definition['description']]);
            }

            if ($workspace->wasRecentlyCreated) {
                DefaultBoardLists::seedForWorkspace($workspace, $org);
            }

            foreach ($dummyUsers as $user) {
                if ($user->workspaces()->where('workspaces.id', $workspace->id)->exists()) {
                    continue;
                }

                $workspace->memberships()->attach($user->id, [
                    'role' => $user->id === $admin->id
                        ? MembershipRole::Admin->value
                        : MembershipRole::Member->value,
                    'added_by' => $admin->id,
                ]);
            }

            $labelIds = WorkspaceLabel::query()
                ->where('organization_id', $org->id)
                ->whereIn('name', $definition['labels'])
                ->pluck('id')
                ->all();
            $workspace->labels()->sync($labelIds);

            $assigneeNames = array_map(
                fn (int $number) => 'dmy_user_'.sprintf('%02d', $number),
                $definition['assignee_numbers'],
            );
            $assigneeIds = User::query()
                ->whereIn('name', $assigneeNames)
                ->orderBy('id')
                ->pluck('id')
                ->all();
            $workspace->assignees()->sync($assigneeIds);
        }
    }
}
