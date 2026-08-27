<?php

namespace Tests\Feature\Invites;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanListPendingInvitesTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    public function test_admin_can_list_pending_invites(): void
    {
        Mail::fake();
        [$admin] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'a@example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/invites')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.email', 'a@example.com');
    }
}
