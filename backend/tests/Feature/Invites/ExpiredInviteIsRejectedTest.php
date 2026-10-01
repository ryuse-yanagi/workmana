<?php

namespace Tests\Feature\Invites;

use App\Models\Organization\OrganizationInvite;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ExpiredInviteIsRejectedTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 期限切れの招待は拒否される */
    public function test_expired_invite_is_rejected(): void
    {
        [$admin, $org] = $this->createOrgWithAdmin();
        $plainToken = 'expired-token-value';
        OrganizationInvite::query()->create([
            'organization_id' => $org->id,
            'email' => 'late@example.com',
            'role' => 'member',
            'token' => OrganizationInvite::hashToken($plainToken),
            'expires_at' => now()->subDay(),
        ]);

        $this->getJson('/api/invites/'.$plainToken)
            ->assertStatus(410)
            ->assertJsonPath('status', 'expired');

        $this->postJson('/api/invites/'.$plainToken.'/accept', [
            'name' => '遅れた人',
            'password' => 'password123',
        ])
            ->assertStatus(410);
    }
}
