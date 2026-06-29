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
    /** @var list<string> */
    private const WORKSPACE_NAMES = ['dmy_ws_a', 'dmy_ws_b', 'dmy_ws_c'];

    public function run (): void
    {
        $org = Organization::query()->where('slug', OrganizationSeeder::SLUG)->first();
        if ($org === null) {
            $this->command?->warn('Organization "'.OrganizationSeeder::SLUG.'" not found. Run OrganizationSeeder first.');

            return;
        }

        $admin = User::query()->where('name', 'dmy_user_1')->first();
        if ($admin === null) {
            $this->command?->warn('dmy_user_1 not found. Run UserSeeder first.');

            return;
        }

        $dummyUsers = User::query()
            ->where('name', 'like', 'dmy_user_%')
            ->orderBy('id')
            ->get();

        foreach (self::WORKSPACE_NAMES as $workspaceName) {
            $workspace = Workspace::query()->firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'name' => $workspaceName,
                ],
                [
                    'created_by' => $admin->id,
                    'description' => null,
                ],
            );

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
        }
    }
}
