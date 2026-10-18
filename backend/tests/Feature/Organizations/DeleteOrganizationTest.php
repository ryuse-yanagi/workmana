<?php

namespace Tests\Feature\Organizations;

use App\Events\Organization\OrganizationChanged;
use App\Models\Document\Document;
use App\Models\Notification\AppNotification;
use App\Models\Organization\Organization;
use App\Models\Organization\OrganizationInvite;
use App\Models\User;
use App\Models\Workspace\Workspace;
use App\Models\Workspace\WorkspaceLabel;
use App\Models\Workspace\WorkspaceLabelCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DeleteOrganizationTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 管理者は組織と配下データを削除でき、残りの所属へ現在組織が移る */
    public function test_admin_can_delete_organization_and_related_data(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create(['name' => 'Member']);
        $organization->members()->attach($member->id, ['role' => 'member']);

        $remaining = $this->createOrganizationForUser($admin, 'Remaining', 'remain');
        $remaining->members()->attach($member->id, ['role' => 'member']);
        $admin->forceFill(['last_organization_id' => $organization->id])->save();
        $member->forceFill(['last_organization_id' => $organization->id])->save();

        $activeId = $this->createWorkspaceViaApi($admin, 'acme', 'Active space');
        $archivedId = $this->createWorkspaceViaApi($admin, 'acme', 'Archived space');
        $trashedId = $this->createWorkspaceViaApi($admin, 'acme', 'Trashed space');
        $remainingWorkspaceId = $this->createWorkspaceViaApi($admin, 'remain', 'Keep space');

        $archived = Workspace::query()->findOrFail($archivedId);
        $archived->archived_at = now();
        $archived->save();
        Workspace::query()->findOrFail($trashedId)->delete();

        $active = Workspace::query()->findOrFail($activeId);
        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $active->id,
            'created_by' => $admin->id,
            'name' => 'Notes',
        ]);
        $listId = $this->defaultListId($active);
        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$active->id}/tasks", [
                'title' => 'Gone with the org',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');

        $category = WorkspaceLabelCategory::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $admin->id,
            'name' => 'Kind',
            'sort_order' => 0,
        ]);
        $label = WorkspaceLabel::query()->create([
            'organization_id' => $organization->id,
            'category_id' => $category->id,
            'created_by' => $admin->id,
            'name' => 'Important',
            'color_index' => 0,
            'sort_order' => 0,
        ]);
        $invite = OrganizationInvite::query()->create([
            'organization_id' => $organization->id,
            'email' => 'invitee@example.com',
            'role' => 'member',
            'token' => hash('sha256', 'plain-token'),
            'expires_at' => now()->addDay(),
        ]);

        $deletedNotice = AppNotification::query()->create([
            'user_id' => $member->id,
            'type' => 'organization.role_changed',
            'data' => [
                'organization_slug' => 'acme',
                'organization_name' => 'Acme',
                'title' => 'Acme',
            ],
        ]);
        $keptNotice = AppNotification::query()->create([
            'user_id' => $admin->id,
            'type' => 'organization.role_changed',
            'data' => [
                'organization_slug' => 'remain',
                'organization_name' => 'Remaining',
                'title' => 'Remaining',
            ],
        ]);

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme')
            ->assertNoContent();

        $this->assertDatabaseMissing('organizations', ['id' => $organization->id]);
        $this->assertDatabaseMissing('memberships', ['organization_id' => $organization->id]);
        $this->assertDatabaseMissing('workspaces', ['id' => $activeId]);
        $this->assertDatabaseMissing('workspaces', ['id' => $archivedId]);
        $this->assertDatabaseMissing('workspaces', ['id' => $trashedId]);
        $this->assertDatabaseMissing('tasks', ['id' => $taskId]);
        $this->assertDatabaseMissing('shared_documents', ['id' => $document->id]);
        $this->assertDatabaseMissing('workspace_labels', ['id' => $label->id]);
        $this->assertDatabaseMissing('workspace_label_categories', ['id' => $category->id]);
        $this->assertDatabaseMissing('organization_invites', ['id' => $invite->id]);
        $this->assertDatabaseMissing('app_notifications', ['id' => $deletedNotice->id]);

        $this->assertDatabaseHas('organizations', ['id' => $remaining->id]);
        $this->assertDatabaseHas('workspaces', ['id' => $remainingWorkspaceId]);
        $this->assertDatabaseHas('memberships', [
            'organization_id' => $remaining->id,
            'user_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('memberships', [
            'organization_id' => $remaining->id,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('app_notifications', ['id' => $keptNotice->id]);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('users', ['id' => $member->id]);

        $admin->refresh();
        $member->refresh();
        $this->assertSame($remaining->id, $admin->last_organization_id);
        $this->assertSame($remaining->id, $member->last_organization_id);
    }

    /** 唯一の組織を削除すると現在組織は未設定になる */
    public function test_deleting_the_only_organization_clears_last_organization(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $admin->forceFill(['last_organization_id' => $organization->id])->save();

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme')
            ->assertNoContent();

        $admin->refresh();
        $this->assertNull($admin->last_organization_id);
        $this->assertSame(0, $admin->organizations()->count());
    }

    /** 組織アイコンのファイルも削除する */
    public function test_deleting_organization_removes_its_icon_file(): void
    {
        config(['filesystems.public_media' => 'public']);
        Storage::fake('public');

        [$admin, $organization] = $this->createOrgWithAdmin();
        Storage::disk('public')->put('org-icons/acme.png', 'icon');
        $organization->icon_path = 'org-icons/acme.png';
        $organization->save();

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme')
            ->assertNoContent();

        Storage::disk('public')->assertMissing('org-icons/acme.png');
    }

    /** 削除の途中で失敗したら、スペース・資料・現在組織の付け替えも残る */
    public function test_failed_organization_delete_rolls_back_related_rows(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $remaining = $this->createOrganizationForUser($admin, 'Remaining', 'remain');
        $admin->forceFill(['last_organization_id' => $organization->id])->save();

        $workspaceId = $this->createWorkspaceViaApi($admin, 'acme', 'Keep space');
        $workspace = Workspace::query()->findOrFail($workspaceId);
        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspace->id,
            'created_by' => $admin->id,
            'name' => 'Keep notes',
        ]);
        $listId = $this->defaultListId($workspace);
        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Keep task',
                'list_id' => $listId,
            ])
            ->assertCreated()
            ->json('id');
        $notice = AppNotification::query()->create([
            'user_id' => $admin->id,
            'type' => 'organization.role_changed',
            'data' => [
                'organization_slug' => 'acme',
                'organization_name' => 'Acme',
                'title' => 'Acme',
            ],
        ]);

        Organization::deleting(function () {
            throw new RuntimeException('stop before commit');
        });

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme')
            ->assertStatus(500);

        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
        $this->assertDatabaseHas('organizations', ['id' => $remaining->id]);
        $this->assertDatabaseHas('workspaces', ['id' => $workspaceId]);
        $this->assertDatabaseHas('shared_documents', ['id' => $document->id]);
        $this->assertDatabaseHas('tasks', ['id' => $taskId]);
        $this->assertDatabaseHas('memberships', [
            'organization_id' => $organization->id,
            'user_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('app_notifications', ['id' => $notice->id]);
        $admin->refresh();
        $this->assertSame($organization->id, (int) $admin->last_organization_id);
    }

    /** 削除処理の途中で現在組織が替わっても、その選択を上書きしない */
    public function test_organization_delete_keeps_a_current_organization_chosen_during_delete(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $smaller = $this->createOrganizationForUser($admin, 'Smaller', 'smaller');
        $larger = $this->createOrganizationForUser($admin, 'Larger', 'larger');
        $admin->forceFill(['last_organization_id' => $organization->id])->save();

        $rewritten = false;
        DB::listen(function ($query) use (&$rewritten, $admin, $larger) {
            if ($rewritten) {
                return;
            }
            $sql = strtolower($query->sql);
            if (! str_starts_with(ltrim($sql), 'select') || ! str_contains($sql, 'from "users"')) {
                return;
            }
            if (! str_contains($sql, 'last_organization_id')) {
                return;
            }
            $rewritten = true;
            DB::table('users')->where('id', $admin->id)->update([
                'last_organization_id' => $larger->id,
            ]);
        });

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme')
            ->assertNoContent();

        $admin->refresh();
        $this->assertSame($larger->id, (int) $admin->last_organization_id);
        $this->assertNotSame($smaller->id, (int) $admin->last_organization_id);
    }

    /** 削除が確定した組織を、開いている他クライアントへ知らせる */
    public function test_deleting_organization_broadcasts_organization_deleted(): void
    {
        Event::fake([OrganizationChanged::class]);

        [$admin, $organization] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme')
            ->assertNoContent();

        Event::assertDispatched(OrganizationChanged::class, function (OrganizationChanged $event) use ($organization) {
            $payload = $event->broadcastWith();

            return $event->organizationId === (int) $organization->id
                && $event->type === 'organization.deleted'
                && ($payload['id'] ?? null) === (int) $organization->id
                && ($payload['slug'] ?? null) === 'acme';
        });
    }

    /** 一般ユーザーは組織を削除できない */
    public function test_member_cannot_delete_organization(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($member)
            ->deleteJson('/api/orgs/acme')
            ->assertForbidden();

        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
        $this->assertNotNull($admin->id);
    }

    /** 未所属ユーザーは組織を削除できない */
    public function test_non_member_cannot_delete_organization(): void
    {
        [, $organization] = $this->createOrgWithAdmin();
        $outsider = User::factory()->create();

        $this->actingAsApiUser($outsider)
            ->deleteJson('/api/orgs/acme')
            ->assertForbidden();

        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
    }

    /** 未ログインでは組織を削除できない */
    public function test_guest_cannot_delete_organization(): void
    {
        [, $organization] = $this->createOrgWithAdmin();

        $this->deleteJson('/api/orgs/acme')->assertUnauthorized();

        $this->assertDatabaseHas('organizations', ['id' => $organization->id]);
    }
}
