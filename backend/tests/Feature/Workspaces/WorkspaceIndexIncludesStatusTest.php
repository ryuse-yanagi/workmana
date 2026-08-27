<?php

namespace Tests\Feature\Workspaces;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WorkspaceIndexIncludesStatusTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_workspace_index_includes_status(): void
    {
        $user = User::factory()->create();

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
                'status' => '稼働中',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonPath('data.0.status.name', '稼働中')
            ->assertJsonPath('data.0.status.color_index', 0);
    }
}
