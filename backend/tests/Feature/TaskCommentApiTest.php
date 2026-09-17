<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Workspace;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskCommentApiTest extends TestCase
{
    use RefreshDatabase;

    private function seedWorkspaceContext(): array
    {
        $user = User::factory()->create([
            'name' => 'Comment Author',
            'email' => 'author@example.com',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'status' => 'todo',
                'list_id' => (int) $workspace->lists()->orderBy('sort_order')->value('id'),
            ])
            ->assertCreated();

        $task = Task::query()->firstOrFail();

        return [$user, $workspace, $task];
    }

    public function test_user_can_create_update_delete_and_react_to_comment(): void
    {
        [$user, $workspace, $task] = $this->seedWorkspaceContext();

        $createRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments", [
                'body' => 'Initial comment',
            ])
            ->assertCreated()
            ->assertJsonPath('body', 'Initial comment')
            ->assertJsonPath('author.name', 'Comment Author')
            ->assertJsonPath('author.email', 'author@example.com');

        $commentId = $createRes->json('id');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments")
            ->assertOk()
            ->assertJsonPath('data.0.author.name', 'Comment Author')
            ->assertJsonPath('data.0.body', 'Initial comment');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}", [
                'body' => 'Updated comment',
            ])
            ->assertOk()
            ->assertJsonPath('body', 'Updated comment')
            ->assertJsonPath('edited', true);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}/reactions", [
                'emoji' => '👍',
            ])
            ->assertOk()
            ->assertJsonPath('reactions.0.emoji', '👍')
            ->assertJsonPath('reactions.0.count', 1)
            ->assertJsonPath('reactions.0.reacted_by_me', true);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}/reactions", [
                'emoji' => '👍',
            ])
            ->assertOk()
            ->assertJsonPath('reactions', []);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}")
            ->assertOk();

        $this->assertSoftDeleted('task_comments', ['id' => $commentId]);
    }

    public function test_other_user_cannot_edit_or_delete_comment(): void
    {
        [$author, $workspace, $task] = $this->seedWorkspaceContext();

        $comment = TaskComment::query()->create([
            'task_id' => $task->id,
            'organization_id' => $workspace->organization_id,
            'workspace_id' => $workspace->id,
            'author_id' => $author->id,
            'body' => 'Protected comment',
        ]);

        $other = User::factory()->create();
        $organization = Organization::query()->where('slug', 'acme')->firstOrFail();
        $organization->members()->attach($other->id, ['role' => 'member']);
        $workspace->memberships()->attach($other->id, ['role' => 'member']);

        $this->withHeader('Authorization', 'Bearer '.$other->id)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$comment->id}", [
                'body' => 'Hacked',
            ])
            ->assertForbidden();

        $this->withHeader('Authorization', 'Bearer '.$other->id)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$comment->id}")
            ->assertForbidden();
    }

    public function test_user_can_list_workspace_task_comments_grouped_by_task(): void
    {
        [$user, $workspace, $task] = $this->seedWorkspaceContext();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments", [
                'body' => 'Bulk listed comment',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/comments")
            ->assertOk()
            ->assertJsonPath("data.{$task->id}.0.body", 'Bulk listed comment');
    }
}
