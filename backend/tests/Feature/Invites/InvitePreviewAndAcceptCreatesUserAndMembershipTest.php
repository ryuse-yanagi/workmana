<?php

namespace Tests\Feature\Invites;

use App\Mail\OrganizationInviteMail;
use App\Models\Organization\OrganizationInvite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class InvitePreviewAndAcceptCreatesUserAndMembershipTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 招待のプレビューと承諾でユーザーと所属が作成される */
    public function test_invite_preview_and_accept_creates_user_and_membership(): void
    {
        Mail::fake();
        [$admin, $org] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/invites', [
                'email' => 'invitee@example.com',
                'role' => 'member',
            ])
            ->assertCreated();

        $plainToken = null;
        Mail::assertSent(OrganizationInviteMail::class, function (OrganizationInviteMail $mail) use (&$plainToken) {
            $plainToken = $mail->plainToken;

            return true;
        });
        $this->assertNotNull($plainToken);

        $this->getJson('/api/invites/'.$plainToken)
            ->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('email', 'invitee@example.com')
            ->assertJsonPath('organization.slug', 'acme');

        $this->postJson('/api/invites/'.$plainToken.'/accept', [
            'name' => '招待太郎',
            'password' => 'password123',
        ])
            ->assertOk()
            ->assertJsonPath('organization.slug', 'acme');

        $user = User::query()->where('email', 'invitee@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('招待太郎', $user->name);
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->cognito_sub);
        $this->assertTrue($org->members()->where('users.id', $user->id)->exists());
        $this->assertSame('member', $org->members()->where('users.id', $user->id)->first()->pivot->role);
        $this->assertSame($org->id, $user->fresh()->last_organization_id);

        $invite = OrganizationInvite::query()->first();
        $this->assertNotNull($invite->used_at);

        $this->getJson('/api/invites/'.$plainToken)
            ->assertStatus(410)
            ->assertJsonPath('status', 'used')
            ->assertJsonPath('message', 'この招待は使用済みです');

        $this->postJson('/api/invites/'.$plainToken.'/accept', [
            'name' => '招待太郎',
            'password' => 'password123',
        ])
            ->assertStatus(410)
            ->assertJsonPath('message', 'この招待は使用済みです');
    }
}
