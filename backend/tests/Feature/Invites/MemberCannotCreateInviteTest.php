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
}
