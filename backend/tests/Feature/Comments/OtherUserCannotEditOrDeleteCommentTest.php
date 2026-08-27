<?php

namespace Tests\Feature\Comments;

use App\Models\Organization;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class OtherUserCannotEditOrDeleteCommentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_other_user_cannot_edit_or_delete_comment(): void
    {
        $author = User::factory()->create([
            'name' => 'Comment Author',
            'email' => 'author@example.com',
        ]);

        $this->actingAsApiUser($author)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->actingAsApiUser($author)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($author)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'list_id' => $this->defaultListId($workspace),
            ])
            ->assertCreated();

        $task = Task::query()->firstOrFail();

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

        $this->actingAsApiUser($other)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$comment->id}", [
                'body' => 'Hacked',
            ])
            ->assertForbidden();

        $this->actingAsApiUser($other)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$comment->id}")
            ->assertForbidden();
    }
}
