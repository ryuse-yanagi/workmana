<?php

namespace Tests\Feature;

use App\Mail\OrganizationInviteMail;
use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Models\SharedDocument;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AccessControlApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
        config(['cognito.bypass' => true]);
    }

    public function test_member_only_sees_assigned_workspaces_admin_sees_all(): void
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
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible);

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/workspaces')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAsApiUser($member)
            ->getJson("/api/orgs/acme/workspaces/{$hidden}")
            ->assertForbidden();

        $this->assertDatabaseHas('workspace_memberships', [
            'workspace_id' => $visible,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseHas('workspace_assignees', [
            'workspace_id' => $visible,
            'user_id' => $member->id,
        ]);
    }

    public function test_member_only_sees_viewer_documents_admin_sees_all(): void
    {
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $visibleId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/documents', [
                'name' => 'Visible doc',
                'viewer_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');

        $hiddenId = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/documents', [
                'name' => 'Hidden doc',
                'viewer_ids' => [$admin->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($member)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visibleId);

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAsApiUser($member)
            ->getJson("/api/orgs/acme/documents/{$hiddenId}")
            ->assertForbidden();
    }

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
                'name' => 'Team doc',
                'viewer_ids' => [$admin->id, $member->id],
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
        $this->assertDatabaseMissing('workspace_memberships', [
            'workspace_id' => $workspaceId,
            'user_id' => $member->id,
        ]);
        $this->assertDatabaseMissing('document_viewers', [
            'shared_document_id' => $documentId,
            'user_id' => $member->id,
        ]);
    }

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

        $this->assertNotNull($invite->fresh()->revoked_at);

        $plainToken = null;
        Mail::assertSent(OrganizationInviteMail::class, function (OrganizationInviteMail $mail) use (&$plainToken) {
            $plainToken = $mail->plainToken;

            return true;
        });

        $this->getJson('/api/invites/'.$plainToken)
            ->assertStatus(410)
            ->assertJsonPath('status', 'revoked');
    }

    public function test_existing_cognito_user_invite_requires_password(): void
    {
        Mail::fake();
        [$admin] = $this->createOrgWithAdmin();
        $existing = User::factory()->create([
            'email' => 'existing@example.com',
            'password' => 'correct-password',
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
            'password' => 'wrong-password',
        ])->assertStatus(422);

        $this->postJson('/api/invites/'.$plainToken.'/accept', [
            'name' => 'Joined',
            'password' => 'correct-password',
        ])->assertOk();

        $this->assertTrue(
            Organization::query()->where('slug', 'acme')->firstOrFail()
                ->members()->where('users.id', $existing->id)->exists()
        );
        $this->assertSame('Joined', $existing->fresh()->name);
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
