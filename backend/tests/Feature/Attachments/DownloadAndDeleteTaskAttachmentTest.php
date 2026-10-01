<?php

namespace Tests\Feature\Attachments;

use App\Models\Task\TaskAttachment;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DownloadAndDeleteTaskAttachmentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 添付のダウンロードはファイルを返し、削除するとDBとストレージの両方から消える */
    public function test_attachments_can_be_downloaded_and_deleted(): void
    {
        [$admin, , $member] = $this->createOrgWithAdminAndMember();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Files',
                'assignee_ids' => [$admin->id, $member->id],
            ])
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

        $download = $this->actingAsApiUser($admin)
            ->get("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$attachmentId}/download")
            ->assertOk();
        $this->assertStringStartsWith(
            'attachment',
            strtolower((string) $download->headers->get('content-disposition')),
        );

        $inline = $this->actingAsApiUser($admin)
            ->get("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$attachmentId}/download?inline=1")
            ->assertOk();
        $this->assertStringStartsWith(
            'inline',
            strtolower((string) $inline->headers->get('content-disposition')),
        );
        $this->assertStringContainsString(
            'rel="icon"',
            (string) $inline->headers->get('Link'),
        );

        $storedPath = TaskAttachment::query()->findOrFail($attachmentId)->path;
        Storage::disk($this->privateMediaDisk())->assertExists($storedPath);

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$attachmentId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('task_attachments', ['id' => $attachmentId]);
        Storage::disk($this->privateMediaDisk())->assertMissing($storedPath);
    }

    /** クライアントが text/html と申告しても、プレビューは text/plain で返す */
    public function test_inline_preview_ignores_client_supplied_html_content_type(): void
    {
        [$admin] = $this->createOrgWithAdmin();

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Files'])
            ->assertCreated()
            ->json('id');
        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');
        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'With file',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $created = $this->actingAsApiUser($admin)
            ->post("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments", [
                'file' => UploadedFile::fake()->create('plan.txt', 8, 'text/html'),
            ], ['Authorization' => 'Bearer '.$admin->id])
            ->assertCreated();
        $this->assertStringStartsWith('text/plain', (string) $created->json('mime_type'));

        $attachmentId = (int) $created->json('id');
        TaskAttachment::query()->whereKey($attachmentId)->update(['mime_type' => 'text/html']);

        $inline = $this->actingAsApiUser($admin)
            ->get("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$attachmentId}/download?inline=1")
            ->assertOk();
        $this->assertStringStartsWith('text/plain', strtolower((string) $inline->headers->get('content-type')));
        $this->assertStringNotContainsString('text/html', strtolower((string) $inline->headers->get('content-type')));
        $this->assertStringStartsWith('inline', strtolower((string) $inline->headers->get('content-disposition')));

        $zipId = (int) $this->actingAsApiUser($admin)
            ->post("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments", [
                'file' => UploadedFile::fake()->create('bundle.zip', 8, 'text/html'),
            ], ['Authorization' => 'Bearer '.$admin->id])
            ->assertCreated()
            ->json('id');

        $zip = $this->actingAsApiUser($admin)
            ->get("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments/{$zipId}/download?inline=1")
            ->assertOk();
        $this->assertStringStartsWith('application/zip', strtolower((string) $zip->headers->get('content-type')));
        $this->assertStringStartsWith('attachment', strtolower((string) $zip->headers->get('content-disposition')));
    }
}
