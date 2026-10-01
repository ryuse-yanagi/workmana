<?php

namespace Tests\Feature\Workspaces;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class PinAndUnpinWorkspaceTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ピン留めは一覧の pinned フラグに反映され、解除すると false に戻る */
    public function test_workspace_can_be_pinned_and_unpinned(): void
    {
        [$user] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Pinned space');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/pin")
            ->assertOk()
            ->assertJsonPath('id', $workspaceId)
            ->assertJsonPath('pinned', true);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonPath('data.0.id', $workspaceId)
            ->assertJsonPath('data.0.pinned', true);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertOk()
            ->assertJsonPath('pinned', true);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}", [
                'name' => 'Pinned space renamed',
            ])
            ->assertOk()
            ->assertJsonPath('pinned', true);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/unpin")
            ->assertOk()
            ->assertJsonPath('pinned', false);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonPath('data.0.pinned', false);
    }
}
