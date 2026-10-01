<?php

namespace Tests\Feature\Organizations;

use App\Mail\OrganizationInviteMail;
use App\Models\Organization\Organization;
use App\Models\Organization\OrganizationInvite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AccessControlApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * スペース／資料の見え方と、メンバー削除のカスケードはここが正本。
     * 分割した Feature テストとは重複するが、削除すると可視性回帰を取りこぼす。
     */
    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
        config(['cognito.bypass' => true]);
    }

    /** 組織メンバーは担当外のワークスペースも開ける */
    public function test_member_can_open_workspaces_they_are_not_assigned_to(): void
    {
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $visible = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Visible space',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');

        $hidden = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Hidden space',
                'assignee_ids' => [$admin->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($member)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAsApiUser($member)
            ->getJson("/api/orgs/acme/workspaces/{$hidden}")
            ->assertOk()
            ->assertJsonPath('id', $hidden);

        $this->assertDatabaseHas('workspace_assignees', [
            'workspace_id' => $visible,
            'user_id' => $member->id,
        ]);
    }

    /** 組織メンバーは担当外の資料も開ける */
    public function test_member_can_open_documents_they_are_not_listed_on(): void
    {
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);
        $workspaceId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Docs',
            ])
            ->assertCreated()
            ->json('id');

        $firstId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/documents', [
                'workspace_id' => $workspaceId,
                'name' => 'First doc',
            ])
            ->assertCreated()
            ->json('id');

        $secondId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/documents', [
                'workspace_id' => $workspaceId,
                'name' => 'Second doc',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($member)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAsApiUser($member)
            ->getJson("/api/orgs/acme/documents/{$secondId}")
            ->assertOk()
            ->assertJsonPath('id', $secondId);

        $this->actingAsApiUser($member)
            ->getJson("/api/orgs/acme/documents/{$firstId}")
            ->assertOk()
            ->assertJsonPath('id', $firstId);
    }

    /** メンバーはアーカイブを閲覧できるが復元・削除はできない */
    public function test_member_can_view_archive_but_cannot_restore_or_delete(): void
    {
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $workspaceId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Shared',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/archive")
            ->assertOk();

        $this->actingAsApiUser($member)
            ->getJson('/api/orgs/acme/workspaces/archived')
            ->assertOk()
            ->assertJsonPath('data.0.id', $workspaceId);

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/unarchive")
            ->assertForbidden();

        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertForbidden();

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/unarchive")
            ->assertOk();
    }

    /** 管理者がメンバーを削除するとアクセス権限も連動して消える */
    public function test_admin_can_remove_member_and_cascade_access(): void
    {
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $workspaceId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Team space',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');

        $documentId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/documents', [
                'workspace_id' => $workspaceId,
                'name' => 'Team doc',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/members/{$member->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('memberships', [
            'organization_id' => $org->id,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('workspace_assignees', [
            'workspace_id' => $workspaceId,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('shared_documents', [
            'id' => $documentId,
            'name' => 'Team doc',
        ]);
    }

    /** 管理者がメンバーのロール変更と招待取り消しができる */
    public function test_admin_can_change_member_role_and_revoke_invite(): void
    {
        Mail::fake();
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/members/{$member->id}", ['role' => 'admin'])
            ->assertOk()
            ->assertJsonPath('role', 'admin');

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'pending@example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $invite = OrganizationInvite::query()->firstOrFail();

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/invites/{$invite->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('organization_invites', ['id' => $invite->id]);

        $plainToken = null;
        Mail::assertSent(OrganizationInviteMail::class, function (OrganizationInviteMail $mail) use (&$plainToken) {
            $plainToken = $mail->plainToken;

            return true;
        });

        $this->getJson('/api/invites/'.$plainToken)
            ->assertNotFound()
            ->assertJsonPath('status', 'invalid');
    }

    /** 既存Cognitoユーザーの招待承諾には認証が必要 */
    public function test_existing_cognito_user_invite_requires_authentication(): void
    {
        Mail::fake();
        [$admin] = $this->createOrgWithAdmin();
        $existing = User::factory()->create([
            'email' => 'existing@example.com',
            'cognito_sub' => 'local-existing-sub',
            'name' => 'Existing',
        ]);

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'existing@example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $plainToken = null;
        Mail::assertSent(OrganizationInviteMail::class, function (OrganizationInviteMail $mail) use (&$plainToken) {
            $plainToken = $mail->plainToken;

            return true;
        });

        $this->postJson('/api/invites/'.$plainToken.'/accept', [
            'name' => 'Hacker',
            'password' => 'password123',
        ])->assertUnauthorized();

        $this->actingAsApiUser($existing)
            ->postJson('/api/invites/'.$plainToken.'/accept', [])
            ->assertOk();

        $this->assertTrue(
            Organization::query()->where('slug', 'acme')->firstOrFail()
                ->members()->where('users.id', $existing->id)->exists()
        );
        $this->assertSame('Existing', $existing->fresh()->name);
    }

    /**
     * @return array{0: User, 1: Organization}
     */
    private function createOrgWithAdmin(): array
    {
        $admin = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $admin->id,
        ]);
        $org->members()->attach($admin->id, ['role' => 'admin']);

        return [$admin, $org];
    }

    private function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }
}
