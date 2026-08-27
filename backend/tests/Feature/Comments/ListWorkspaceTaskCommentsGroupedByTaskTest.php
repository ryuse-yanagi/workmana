<?php

namespace Tests\Feature\Comments;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListWorkspaceTaskCommentsGroupedByTaskTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_user_can_list_workspace_task_comments_grouped_by_task(): void
    {
        $user = User::factory()->create([
            'name' => 'Comment Author',
            'email' => 'author@example.com',
        ]);

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'list_id' => $this->defaultListId($workspace),
            ])
            ->assertCreated();

        $task = Task::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments", [
                'body' => 'Bulk listed comment',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/comments")
            ->assertOk()
            ->assertJsonPath("data.{$task->id}.0.body", 'Bulk listed comment');
    }
}
