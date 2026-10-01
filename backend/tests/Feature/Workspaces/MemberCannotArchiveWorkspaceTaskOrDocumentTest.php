<?php

namespace Tests\Feature\Workspaces;

use App\Models\Document\Document;
use App\Models\Task\Task;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MemberCannotArchiveWorkspaceTaskOrDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 一般メンバーはワークスペース・タスク・資料をアーカイブできない（担当者でも不可） */
    public function test_member_cannot_archive_workspace_task_or_document(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Space',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');
        $listId = $this->defaultListId(Workspace::query()->findOrFail($workspaceId));

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Member task',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $document = Document::query()->create([
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

    /** 一般メンバーはアーカイブ後の復元・完全削除もできない */
    public function test_member_cannot_unarchive_or_permanently_delete_workspace_or_task(): void
    {
        [$admin, , $member] = $this->createOrgWithAdminAndMember();
        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Space',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');
        $listId = $this->defaultListId(Workspace::query()->findOrFail($workspaceId));

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Member task',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/archive")
            ->assertOk();
        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/archive")
            ->assertOk();

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/unarchive")
            ->assertForbidden();
        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertForbidden();

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/unarchive")
            ->assertOk();

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/unarchive")
            ->assertForbidden();
        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}")
            ->assertForbidden();

        $this->assertNotNull(Workspace::query()->find($workspaceId));
        $this->assertNotNull(Task::query()->find($taskId)?->archived_at);
    }
}
