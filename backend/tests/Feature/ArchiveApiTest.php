<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ArchiveApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_workspace_can_be_archived_restored_and_permanently_deleted(): void
    {
        [$user] = $this->createOrganizationMember();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Project space'])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}")
            ->assertUnprocessable();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/archive")
            ->assertOk()
            ->assertJsonPath('name', 'Project space');

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertJsonPath('data', []);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/workspaces/archived')
            ->assertJsonPath('data.0.id', $workspace->id);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('archived_at', null);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspace->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('workspaces', ['id' => $workspace->id]);
    }

    public function test_workspace_with_tasks_can_be_permanently_deleted(): void
    {
        [$user, $organization] = $this->createOrganizationMember();

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
        $listId = (int) $workspace->lists()->orderBy('sort_order')->value('id');

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

    public function test_task_complete_deletion_physically_removes_row(): void
    {
        [$user] = $this->createOrganizationMember();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Task space'])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();
        $listId = (int) $workspace->lists()->orderBy('sort_order')->value('id');

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

    public function test_document_can_be_archived_restored_and_permanently_deleted(): void
    {
        [$user, $organization] = $this->createOrganizationMember();
        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'Design notes',
        ]);
        $relatedDocument = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'Survivor notes',
        ]);

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Linked space'])
            ->assertCreated();
        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->putJson("/api/orgs/acme/documents/{$document->id}/related-documents", [
                'document_ids' => [$relatedDocument->id],
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->putJson("/api/orgs/acme/documents/{$document->id}/related-workspaces", [
                'workspace_ids' => [$workspace->id],
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertUnprocessable();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk()
            ->assertJsonPath('name', 'Design notes');

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents')
            ->assertJsonMissing(['id' => $document->id]);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents/archived')
            ->assertJsonPath('data.0.id', $document->id);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('archived_at', null);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('shared_documents', ['id' => $document->id]);
        $this->assertDatabaseMissing('document_document_label', ['shared_document_id' => $document->id]);
        $this->assertDatabaseMissing('document_related_document', ['document_id' => $document->id]);
        $this->assertDatabaseMissing('document_related_document', ['related_document_id' => $document->id]);
        $this->assertDatabaseMissing('workspace_related_document', ['shared_document_id' => $document->id]);

        // 関連先は削除されない
        $this->assertDatabaseHas('shared_documents', ['id' => $relatedDocument->id]);
        $this->assertDatabaseHas('workspaces', ['id' => $workspace->id]);
    }

    /**
     * @return array{User, Organization}
     */
    private function createOrganizationMember(): array
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        return [$user, $organization];
    }

    private function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }
}
