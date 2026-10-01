<?php

namespace Tests\Feature\Workspaces;

use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateWorkspaceWithStatusLabelsAndAssigneesTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ワークスペースをステータス・ラベル・担当者付きで更新できる */
    public function test_workspace_can_be_updated_with_status_labels_and_assignees(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();

        $categoryId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspace-label-categories', ['name' => '種別'])
            ->assertCreated()
            ->json('id');

        $labelId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspace-labels', [
                'category_id' => $categoryId,
                'name' => '重要',
                'color_index' => 0,
            ])
            ->assertCreated()
            ->json('id');

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Editable'])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}", [
                'name' => 'Editable Renamed',
                'description' => 'Updated description',
                'status' => '稼働中',
                'label_ids' => [$labelId],
                'assignee_ids' => [$member->id],
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Editable Renamed')
            ->assertJsonPath('description', 'Updated description')
            ->assertJsonPath('status.name', '稼働中')
            ->assertJsonPath('labels.0.id', $labelId)
            ->assertJsonPath('assignees.0.id', $member->id);

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertOk()
            ->assertJsonPath('name', 'Editable Renamed')
            ->assertJsonPath('assignees.0.id', $member->id);

        $this->assertSame($organization->id, Workspace::query()->findOrFail($workspaceId)->organization_id);
    }
}
