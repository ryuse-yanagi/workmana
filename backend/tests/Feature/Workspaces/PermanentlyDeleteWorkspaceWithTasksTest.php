<?php

namespace Tests\Feature\Workspaces;

use App\Models\Document\Document;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class PermanentlyDeleteWorkspaceWithTasksTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** タスク付きワークスペースを完全削除できる */
    public function test_workspace_with_tasks_can_be_permanently_deleted(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Busy space'])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $document = Document::query()->create([
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
        $this->assertDatabaseMissing('task_assignees', ['task_id' => $taskId]);
        $this->assertDatabaseMissing('lists', ['workspace_id' => $workspace->id]);
        $this->assertDatabaseMissing('workspace_assignees', ['workspace_id' => $workspace->id]);

        $this->assertDatabaseMissing('shared_documents', ['id' => $document->id]);
    }

    /** 別スペースの資料は、片方のスペースを完全削除しても残る */
    public function test_deleting_a_workspace_leaves_documents_that_belong_to_another_workspace(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        $firstId = (int) $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'First'])
            ->assertCreated()
            ->json('id');
        $secondId = (int) $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Second'])
            ->assertCreated()
            ->json('id');

        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $secondId,
            'created_by' => $user->id,
            'name' => 'Second space notes',
            'body' => 'keep me',
        ]);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$firstId}/archive")
            ->assertOk();
        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$firstId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('workspaces', ['id' => $firstId]);
        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'workspace_id' => $secondId,
            'body' => 'keep me',
        ]);
    }
}
