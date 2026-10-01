<?php

namespace Tests\Feature\Invites;

use App\Mail\OrganizationInviteMail;
use App\Models\Organization\OrganizationInvite;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanCreateInviteAndEmailIsSentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 管理者が招待を作成するとメールが送信される */
    public function test_admin_can_create_invite_and_email_is_sent(): void
    {
        Mail::fake();
        [$admin, $org] = $this->createOrgWithAdmin();

        $response = $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'New.Member@Example.com',
                'role' => 'member',
            ])
            ->assertCreated()
            ->assertJsonPath('email', 'new.member@example.com')
            ->assertJsonPath('role', 'member')
            ->assertJsonPath('resent', false);

        $this->assertDatabaseHas('organization_invites', [
            'organization_id' => $org->id,
            'email' => 'new.member@example.com',
            'role' => 'member',
        ]);

        $invite = OrganizationInvite::query()->first();
        $this->assertNotNull($invite);
        $this->assertNull($invite->used_at);
        $this->assertTrue($invite->expires_at->greaterThan(now()->addDays(6)));
        $this->assertTrue($invite->expires_at->lessThanOrEqualTo(now()->addDays(7)->addMinute()));

        Mail::assertSent(OrganizationInviteMail::class, function (OrganizationInviteMail $mail) {
            return $mail->hasTo('new.member@example.com')
                && str_contains($mail->inviteUrl, '/invite/');
        });

        $this->assertNotEquals($response->json('id'), null);
    }
}
