<?php

namespace Tests\Feature\Tasks;

use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class TaskCompleteDeletionPhysicallyRemovesRowTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_task_complete_deletion_physically_removes_row(): void
    {
        [$user] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Task space'])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();
        $listId = $this->defaultListId($workspace);

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Delete permanently',
                'list_id' => $listId,
                'is_parent_task' => true,
            ])
            ->assertCreated()
            ->json('id');

        $childTaskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Child deleted with parent',
                'list_id' => $listId,
                'parent_task_id' => $taskId,
            ])
            ->assertCreated()
            ->json('id');

        $commentId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}/comments", [
                'body' => 'Bye',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}/comments/{$commentId}/reactions", [
                'emoji' => '🎉',
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$taskId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('tasks', ['id' => $taskId]);
        $this->assertDatabaseMissing('tasks', ['id' => $childTaskId]);
        $this->assertDatabaseMissing('task_histories', ['task_id' => $taskId]);
        $this->assertDatabaseMissing('task_histories', ['task_id' => $childTaskId]);
        $this->assertDatabaseMissing('task_comments', ['id' => $commentId]);
        $this->assertDatabaseMissing('task_comment_reactions', ['task_comment_id' => $commentId]);
        $this->assertDatabaseMissing('task_assignees', ['task_id' => $taskId]);

        // スペース側は残る
        $this->assertDatabaseHas('workspaces', ['id' => $workspace->id]);
    }
}
