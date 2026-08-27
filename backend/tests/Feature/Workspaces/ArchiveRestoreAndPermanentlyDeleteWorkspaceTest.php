<?php

namespace Tests\Feature\Workspaces;

use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ArchiveRestoreAndPermanentlyDeleteWorkspaceTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_workspace_can_be_archived_restored_and_permanently_deleted(): void
    {
        [$user] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Project space'])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}")
            ->assertUnprocessable();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/archive")
            ->assertOk()
            ->assertJsonPath('name', 'Project space');

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertJsonPath('data', []);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces/archived')
            ->assertJsonPath('data.0.id', $workspace->id);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('archived_at', null);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('workspaces', ['id' => $workspace->id]);
    }
}
