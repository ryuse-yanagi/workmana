<?php

namespace Tests\Feature\Invites;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CannotInviteExistingMemberTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 既存メンバーは招待できない */
    public function test_cannot_invite_existing_member(): void
    {
        Mail::fake();
        [$admin, $org] = $this->createOrgWithAdmin();
        $member = User::factory()->create(['email' => 'already@example.com']);
        $org->members()->attach($member->id, ['role' => 'member']);

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'already@example.com',
                'role' => 'member',
            ])
            ->assertStatus(422);
    }
}
