<?php

namespace Tests\Feature\Attachments;

use App\Models\Task\Task;
use App\Models\Task\TaskAttachment;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListWorkspaceTaskAttachmentsGroupedByTaskTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** ワークスペースのタスク添付をタスクごとに一覧できる */
    public function test_user_can_list_workspace_task_attachments_grouped_by_task(): void
    {
        $user = User::factory()->create([
            'name' => 'Attachment Uploader',
            'email' => 'uploader@example.com',
        ]);

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'list_id' => $this->defaultListId($workspace),
            ])
            ->assertCreated();

        $task = Task::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->post("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$task->id}/attachments", [
                'file' => UploadedFile::fake()->create('notes.txt', 12, 'text/plain'),
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/attachments")
            ->assertOk()
            ->assertJsonPath("data.{$task->id}.0.original_name", 'notes.txt')
            ->assertJsonPath("data.{$task->id}.0.task_id", $task->id);

        $this->assertDatabaseCount(TaskAttachment::class, 1);
    }
}
