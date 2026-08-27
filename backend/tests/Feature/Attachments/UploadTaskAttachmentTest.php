<?php

namespace Tests\Feature\Attachments;

use App\Enums\MembershipRole;
use App\Models\TaskAttachment;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UploadTaskAttachmentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_attachment_upload_works_and_rejects_disallowed_types(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Notify space'])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Please do this',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->post("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments", [
                'file' => UploadedFile::fake()->create('notes.txt', 12, 'text/plain'),
            ], ['Authorization' => 'Bearer '.$admin->id])
            ->assertCreated()
            ->assertJsonPath('original_name', 'notes.txt');

        Storage::disk('local')->assertExists(
            TaskAttachment::query()->where('task_id', $taskId)->value('path')
        );

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAsApiUser($admin)
            ->withHeader('Accept', 'application/json')
            ->post("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments", [
                'file' => UploadedFile::fake()->create('evil.html', 12, 'text/html'),
            ])
            ->assertStatus(422);
    }
}
