<?php

namespace Tests\Feature\Comments;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateUpdateDeleteAndReactToCommentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_user_can_create_update_delete_and_react_to_comment(): void
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

        $createRes = $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments", [
                'body' => 'Initial comment',
            ])
            ->assertCreated()
            ->assertJsonPath('body', 'Initial comment')
            ->assertJsonPath('author.name', 'Comment Author')
            ->assertJsonPath('author.email', 'author@example.com');

        $commentId = $createRes->json('id');

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments")
            ->assertOk()
            ->assertJsonPath('data.0.author.name', 'Comment Author')
            ->assertJsonPath('data.0.body', 'Initial comment');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}", [
                'body' => 'Updated comment',
            ])
            ->assertOk()
            ->assertJsonPath('body', 'Updated comment')
            ->assertJsonPath('edited', true);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}/reactions", [
                'emoji' => '👍',
            ])
            ->assertOk()
            ->assertJsonPath('reactions.0.emoji', '👍')
            ->assertJsonPath('reactions.0.count', 1)
            ->assertJsonPath('reactions.0.reacted_by_me', true);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}/reactions", [
                'emoji' => '👍',
            ])
            ->assertOk()
            ->assertJsonPath('reactions', []);

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/comments/{$commentId}")
            ->assertOk();

        $this->assertSoftDeleted('task_comments', ['id' => $commentId]);
    }
}
