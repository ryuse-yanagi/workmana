<?php

namespace Tests\Feature\Invites;

use App\Enums\MembershipRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanRevokeInviteTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_admin_can_revoke_invite(): void
    {
        [$admin] = $this->createOrgWithAdmin();

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
}
