<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PermissionHardeningApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_can_view_archived_workspace_but_cannot_restore_or_delete(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Space'])
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
    }

    public function test_org_member_can_be_task_assignee_and_listed_in_workspace_members(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create(['name' => 'Teammate']);
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Open space',
            ])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Assigned work',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->assertJsonPath('assignees.0.id', $member->id);

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/members")
            ->assertOk()
            ->assertJsonFragment(['id' => $member->id]);
    }

    public function test_admin_can_remove_member_and_revoke_invite(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/members/{$member->id}")
            ->assertNoContent();

        $this->assertFalse($organization->members()->where('users.id', $member->id)->exists());

        $inviteId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'newcomer@example.com',
                'role' => MembershipRole::Member->value,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/invites/{$inviteId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('organization_invites', ['id' => $inviteId]);
    }

    public function test_existing_cognito_user_cannot_accept_invite_with_password_only(): void
    {
        [$admin] = $this->createOrgWithAdmin();
        $existing = User::factory()->create([
            'email' => 'existing@example.com',
            'cognito_sub' => 'sub-existing',
            'name' => 'Existing',
        ]);

        $plain = 'plain-invite-token-value-32bytes!!';
        OrganizationInvite::query()->create([
            'organization_id' => Organization::query()->where('slug', 'acme')->value('id'),
            'email' => 'existing@example.com',
            'role' => MembershipRole::Member->value,
            'token' => OrganizationInvite::hashToken($plain),
            'expires_at' => now()->addDay(),
        ]);

        $this->postJson("/api/invites/{$plain}/accept", [
            'name' => 'Hacker',
            'password' => 'password123',
        ])->assertUnauthorized();

        $this->actingAsApiUser($existing)
            ->postJson("/api/invites/{$plain}/accept", [])
            ->assertOk();

        $this->assertTrue(
            Organization::query()->where('slug', 'acme')->firstOrFail()
                ->members()->where('users.id', $existing->id)->exists()
        );
        $this->assertSame('Existing', $existing->fresh()->name);
    }

    public function test_member_can_change_role(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/members/{$member->id}", ['role' => 'admin'])
            ->assertOk()
            ->assertJsonPath('role', 'admin');
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
