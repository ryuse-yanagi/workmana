<?php

namespace Tests\Feature\Attachments;

use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListWorkspaceTaskAttachmentsGroupedByTaskTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_user_can_list_workspace_task_attachments_grouped_by_task(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $user = User::factory()->create([
            'name' => 'Attachment Uploader',
            'email' => 'uploader@example.com',
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
            ->post("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}/attachments", [
                'file' => UploadedFile::fake()->create('notes.txt', 12, 'text/plain'),
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/attachments")
            ->assertOk()
            ->assertJsonPath("data.{$task->id}.0.original_name", 'notes.txt')
            ->assertJsonPath("data.{$task->id}.0.task_id", $task->id);

        $this->assertDatabaseCount(TaskAttachment::class, 1);
    }
}
