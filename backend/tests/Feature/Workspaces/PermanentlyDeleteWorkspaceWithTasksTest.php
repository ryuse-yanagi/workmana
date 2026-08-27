<?php

namespace Tests\Feature\Workspaces;

use App\Models\SharedDocument;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class PermanentlyDeleteWorkspaceWithTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_workspace_with_tasks_can_be_permanently_deleted(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Busy space'])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'Linked notes',
        ]);
        $this->actingAsApiUser($user)
            ->putJson("/api/orgs/acme/workspaces/{$workspace->id}/related-documents", [
                'document_ids' => [$document->id],
            ])
            ->assertOk();
        $listId = $this->defaultListId($workspace);

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Keep me until space is gone',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $commentId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}/comments", [
                'body' => 'Comment on a doomed task',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}/comments/{$commentId}/reactions", [
                'emoji' => '👍',
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('workspaces', ['id' => $workspace->id]);
        $this->assertDatabaseMissing('tasks', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('task_histories', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('task_comments', ['task_id' => $taskId]);
        $this->assertDatabaseMissing('task_comment_reactions', ['task_comment_id' => $commentId]);
        $this->assertDatabaseMissing('task_assignees', ['task_id' => $taskId]);
        $this->assertDatabaseMissing('lists', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('workspace_assignees', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('workspace_related_document', ['workspace_id' => $workspace->id]);

        // 関連付けられていた資料は削除されない
        $this->assertDatabaseHas('shared_documents', ['id' => $document->id]);
    }
}
