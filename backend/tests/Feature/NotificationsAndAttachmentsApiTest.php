<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AppNotification;
use App\Models\Organization;
use App\Models\TaskAttachment;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class NotificationsAndAttachmentsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigning_task_creates_notification_and_attachment_upload_works(): void
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

        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.assigned')
                ->exists()
        );

        $this->actingAsApiUser($member)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'task.assigned');

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

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'Hello @[Admin](user:'.$admin->id.')',
            ])
            ->assertCreated();

        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $admin->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );

        $outsider = User::factory()->create();
        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'Ping @[Outsider](user:'.$outsider->id.')',
            ])
            ->assertCreated();

        $this->assertFalse(
            AppNotification::query()
                ->where('user_id', $outsider->id)
                ->where('type', 'task.mentioned')
                ->exists()
        );

        $this->actingAsApiUser($admin)
            ->withHeader('Accept', 'application/json')
            ->post("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/attachments", [
                'file' => UploadedFile::fake()->create('evil.html', 12, 'text/html'),
            ])
            ->assertStatus(422);
    }

    /**
     * @return array{User, Organization}
     */
    private function createOrgWithAdmin(): array
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => MembershipRole::Admin->value]);

        return [$user, $organization];
    }

    private function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }
}
