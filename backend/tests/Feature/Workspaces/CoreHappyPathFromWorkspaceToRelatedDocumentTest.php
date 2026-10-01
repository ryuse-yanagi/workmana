<?php

namespace Tests\Feature\Workspaces;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CoreHappyPathFromWorkspaceToRelatedDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ワークスペース作成から、そのスペース配下への資料作成までの基本フロー */
    public function test_core_happy_path_from_workspace_to_workspace_document(): void
    {
        [$admin, , $member] = $this->createOrgWithAdminAndMember();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Delivery',
                'description' => 'Core flow space',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Delivery')
            ->json('id');

        $lists = $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/lists")
            ->assertOk()
            ->json('data');
        $this->assertNotEmpty($lists);
        $listId = (int) $lists[0]['id'];

        $this->syncWorkspaceAssigneesViaApi($admin, 'acme', $workspaceId, [$member->id]);

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Ship feature',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Ship feature')
            ->json('id');

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}")
            ->assertOk()
            ->assertJsonPath('assignees.0.id', $member->id);

        $documentId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/documents", [
                'name' => 'Spec',
                'description' => 'Related notes',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertOk()
            ->assertJsonPath('documents.0.id', $documentId);

        $this->assertDatabaseHas('shared_documents', [
            'id' => $documentId,
            'workspace_id' => $workspaceId,
        ]);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/archive")
            ->assertOk();

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/archived")
            ->assertOk()
            ->assertJsonPath('data.0.id', $taskId);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/unarchive")
            ->assertOk()
            ->assertJsonPath('archived_at', null);

        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'archived_at' => null,
        ]);
    }
}
