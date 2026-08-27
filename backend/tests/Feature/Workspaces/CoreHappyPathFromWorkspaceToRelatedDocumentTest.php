<?php

namespace Tests\Feature\Workspaces;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CoreHappyPathFromWorkspaceToRelatedDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_core_happy_path_from_workspace_to_related_document(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();

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

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'Looking good @[user:'.$admin->id.']',
            ])
            ->assertCreated()
            ->assertJsonPath('body', 'Looking good @[user:'.$admin->id.']');

        $documentId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/documents', [
                'name' => 'Spec',
                'description' => 'Related notes',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->putJson("/api/orgs/acme/workspaces/{$workspaceId}/related-documents", [
                'document_ids' => [$documentId],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.id', $documentId);

        $this->actingAsApiUser($admin)
            ->putJson("/api/orgs/acme/documents/{$documentId}/related-workspaces", [
                'workspace_ids' => [$workspaceId],
            ])
            ->assertOk()
            ->assertJsonPath('data.0.id', $workspaceId);

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertOk()
            ->assertJsonPath('related_documents.0.id', $documentId);

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

        $this->assertSame('acme', $organization->slug);
    }
}
