<?php

namespace Tests\Feature;

use App\Mail\OrganizationInviteMail;
use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OrganizationInviteApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // .env の COGNITO_BYPASS_USER_ID が Bearer を上書きしないようにする
        config(['cognito.bypass_user_id' => null]);
    }

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

    /**
     * @return array{0: User, 1: Organization}
     */
    private function createOrgWithAdmin(): array
    {
        $admin = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $admin->id,
        ]);
        $org->members()->attach($admin->id, ['role' => 'admin']);

        return [$admin, $org];
    }

    private function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }
}
