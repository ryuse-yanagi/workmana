<?php

namespace Tests\Feature\Organizations;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class RenamingDefaultWorkspaceStatusPreservesWorkspaceLinksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_renaming_default_workspace_status_preserves_workspace_links(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_workspace_status_names' => [
                ['name' => '準備中', 'color_index' => 1],
                ['name' => '稼働中', 'color_index' => 0],
            ],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        $workspaceId = (int) $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
                'status' => '稼働中',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/settings', [
                'default_workspace_status_names' => [
                    ['name' => '準備中', 'color_index' => 1],
                    ['name' => '運用中', 'color_index' => 0],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('default_workspace_status_names.1.name', '運用中');

        $this->assertSame('運用中', Workspace::query()->findOrFail($workspaceId)->status);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertOk()
            ->assertJsonPath('status.name', '運用中')
            ->assertJsonPath('status.color_index', 0);
    }

    public function test_deleting_default_workspace_status_clears_workspace_links(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_workspace_status_names' => [
                ['name' => '準備中', 'color_index' => 1],
                ['name' => '稼働中', 'color_index' => 0],
            ],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        $workspaceId = (int) $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
                'status' => '稼働中',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/settings', [
                'default_workspace_status_names' => [
                    ['name' => '準備中', 'color_index' => 1],
                ],
            ])
            ->assertOk();

        $this->assertNull(Workspace::query()->findOrFail($workspaceId)->status);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertOk()
            ->assertJsonPath('status', null);
    }
}

