<?php

namespace Tests\Feature\Workspaces;

use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class WorkspaceIndexReturnsAllItemsWithoutPaginationCapTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_workspace_index_returns_all_items_without_pagination_cap(): void
    {
        [$admin, $organization] = $this->createOrgWithAdminAndMember();

        for ($i = 1; $i <= 55; $i++) {
            Workspace::query()->create([
                'organization_id' => $organization->id,
                'created_by' => $admin->id,
                'name' => sprintf('Space %02d', $i),
            ]);
        }

        $workspaces = $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/workspaces?per_page=50')
            ->assertOk()
            ->json();

        $this->assertSame(55, $workspaces['meta']['total']);
        $this->assertCount(55, $workspaces['data']);
        $this->assertSame(1, $workspaces['meta']['last_page']);
    }
}
