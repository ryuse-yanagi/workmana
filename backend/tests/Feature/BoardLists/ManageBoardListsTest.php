<?php

namespace Tests\Feature\BoardLists;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ManageBoardListsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_board_lists_can_be_created_updated_reordered_and_deleted(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Board'])
            ->assertCreated()
            ->json('id');

        $createdListId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/lists", [
                'name' => 'レビュー',
                'color_index' => 2,
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'レビュー')
            ->assertJsonPath('color_index', 2)
            ->json('id');

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/lists/{$createdListId}", [
                'name' => 'レビュー中',
                'color_index' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('name', 'レビュー中')
            ->assertJsonPath('color_index', 1);

        $listIds = collect(
            $this->actingAsApiUser($admin)
                ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/lists")
                ->assertOk()
                ->json('data')
        )->pluck('id')->map(fn ($id) => (int) $id)->all();

        $reordered = array_reverse($listIds);
        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/lists/reorder", [
                'list_ids' => $reordered,
            ])
            ->assertOk();

        $afterReorder = collect(
            $this->actingAsApiUser($admin)
                ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/lists")
                ->json('data')
        )->pluck('id')->map(fn ($id) => (int) $id)->all();
        $this->assertSame($reordered, $afterReorder);

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/lists/{$createdListId}")
            ->assertNoContent();

        $remainingIds = collect(
            $this->actingAsApiUser($admin)
                ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/lists")
                ->json('data')
        )->pluck('id')->map(fn ($id) => (int) $id)->all();
        $this->assertNotContains($createdListId, $remainingIds);
    }
}
