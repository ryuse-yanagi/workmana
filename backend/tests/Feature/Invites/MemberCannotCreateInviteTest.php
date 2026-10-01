<?php

namespace Tests\Feature\Invites;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MemberCannotCreateInviteTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** メンバーは招待を作成できない */
    public function test_member_cannot_create_invite(): void
    {
        Mail::fake();
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $this->actingAsApiUser($member)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'other@example.com',
                'role' => 'member',
            ])
            ->assertForbidden();
    }

    /** 一般メンバーは招待の一覧・取り消しができない */
    public function test_member_cannot_list_or_revoke_invites(): void
    {
        Mail::fake();
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $org->members()->attach($member->id, ['role' => 'member']);

        $inviteId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'other@example.com',
                'role' => 'member',
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($member)
            ->getJson('/api/orgs/acme/invites')
            ->assertForbidden();

        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/invites/{$inviteId}")
            ->assertForbidden();

        $this->assertDatabaseHas('organization_invites', ['id' => $inviteId]);
    }
}
