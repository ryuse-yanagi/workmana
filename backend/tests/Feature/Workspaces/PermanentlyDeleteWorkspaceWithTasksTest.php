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
            'workspace_id' => $workspace->id,
            'created_by' => $user->id,
            'name' => 'Linked notes',
        ]);
        $listId = $this->defaultListId($workspace);

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Keep me until space is gone',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('workspaces', ['id' => $workspace->id]);
        $this->assertDatabaseMissing('tasks', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('task_histories', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('task_assignees', ['task_id' => $taskId]);
        $this->assertDatabaseMissing('lists', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('workspace_assignees', ['workspace_id' => $workspace->id]);

        // ワークスペースに属する資料も削除される
        $this->assertDatabaseMissing('shared_documents', ['id' => $document->id]);
    }
}
