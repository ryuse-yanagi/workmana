<?php

namespace Database\Seeders;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;
use App\Support\DefaultBoardLists;
use Illuminate\Database\Seeder;

class WorkspaceSeeder extends Seeder
{
    public function run (): void
    {
        $org = Organization::query()->where('slug', DummySeederData::ORG_SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.DummySeederData::ORG_SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $admin = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($admin === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        $members = User::query()
            ->whereIn('name', DummySeederData::userNames())
            ->orderBy('id')
            ->get();

        $workspace = Workspace::query()->firstOrCreate(
            [
                'organization_id' => $org->id,
                'name' => DummySeederData::WORKSPACE_NAME,
            ],
            [
                'created_by' => $admin->id,
                'description' => DummySeederData::WORKSPACE_DESCRIPTION,
                'status' => DummySeederData::WORKSPACE_STATUS,
            ],
        );

        $workspace->update([
            'description' => DummySeederData::WORKSPACE_DESCRIPTION,
            'status' => DummySeederData::WORKSPACE_STATUS,
        ]);

        if ($workspace->wasRecentlyCreated) {
            DefaultBoardLists::seedForWorkspace($workspace, $org);
        }

        foreach ($members as $user) {
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

        $assigneeIds = User::query()
            ->whereIn('name', DummySeederData::WORKSPACE_ASSIGNEE_NAMES)
            ->orderBy('id')
            ->pluck('id')
            ->all();
        $workspace->assignees()->sync($assigneeIds);
    }
}
