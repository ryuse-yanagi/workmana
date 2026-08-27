<?php

namespace Tests\Feature\Attachments;

use App\Models\TaskAttachment;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DownloadAndDeleteTaskAttachmentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_attachments_can_be_downloaded_and_deleted(): void
    {
        Storage::fake('local');

        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Files'])
            ->assertCreated()
            ->json('id');
        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'With file',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->json('id');

        $attachmentId = (int) $this->actingAsApiUser($admin)
            ->post("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments", [
                'file' => UploadedFile::fake()->create('plan.txt', 8, 'text/plain'),
            ], ['Authorization' => 'Bearer '.$admin->id])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->get("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$attachmentId}/download")
            ->assertOk();

        Storage::disk('local')->assertExists(
            TaskAttachment::query()->findOrFail($attachmentId)->path
        );

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$attachmentId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('task_attachments', ['id' => $attachmentId]);
        $this->assertSame($organization->slug, 'acme');
    }
}
