<?php

namespace Tests\Feature\Workspaces;

use App\Models\SharedDocument;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MemberCannotArchiveWorkspaceTaskOrDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_member_cannot_archive_workspace_task_or_document(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $workspaceId = $this->createWorkspaceViaApi($admin, 'acme', 'Space');
        $listId = $this->defaultListId(Workspace::query()->findOrFail($workspaceId));

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
            'title' => 'Member task',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $admin->id,
            'name' => 'Member doc',
        ]);

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/archive")
            ->assertForbidden();

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/archive")
            ->assertForbidden();

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertForbidden();

        $this->assertDatabaseHas('workspaces', [
            'id' => $workspaceId,
            'archived_at' => null,
        ]);
        $this->assertDatabaseHas('tasks', [
            'id' => $taskId,
            'archived_at' => null,
        ]);
        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'archived_at' => null,
        ]);
    }
}
