<?php

namespace Tests\Feature\Invites;

use App\Mail\OrganizationInviteMail;
use App\Models\Organization\OrganizationInvite;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ResendingActiveInviteReusesRecordTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 有効な招待の再送は既存レコードを再利用する */
    public function test_resending_active_invite_reuses_record(): void
    {
        Mail::fake();
        [$admin] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'member@example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $first = OrganizationInvite::query()->first();
        $firstToken = $first->token;

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'member@example.com',
                'role' => 'admin',
            ])
            ->assertOk()
            ->assertJsonPath('resent', true);

        $this->assertSame(1, OrganizationInvite::query()->count());
        $this->assertNotSame($firstToken, OrganizationInvite::query()->first()->token);
        Mail::assertSent(OrganizationInviteMail::class, 2);
    }
}
