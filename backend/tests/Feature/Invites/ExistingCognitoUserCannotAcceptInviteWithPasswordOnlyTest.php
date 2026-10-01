<?php

namespace Tests\Feature\Invites;

use App\Enums\MembershipRole;
use App\Models\Organization\Organization;
use App\Models\Organization\OrganizationInvite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ExistingCognitoUserCannotAcceptInviteWithPasswordOnlyTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 既存Cognitoユーザーはパスワードのみでは招待を承諾できない */
    public function test_existing_cognito_user_cannot_accept_invite_with_password_only(): void
    {
        [$admin] = $this->createOrgWithAdmin();
        $existing = User::factory()->create([
            'email' => 'existing@example.com',
            'cognito_sub' => 'sub-existing',
            'name' => 'Existing',
        ]);

        $plain = 'plain-invite-token-value-32bytes!!';
        OrganizationInvite::query()->create([
            'organization_id' => Organization::query()->where('slug', 'acme')->value('id'),
            'email' => 'existing@example.com',
            'role' => MembershipRole::Member->value,
            'token' => OrganizationInvite::hashToken($plain),
            'expires_at' => now()->addDay(),
        ]);

        $this->postJson("/api/invites/{$plain}/accept", [
            'name' => 'Hacker',
            'password' => 'password123',
        ])->assertUnauthorized();

        $this->actingAsApiUser($existing)
            ->postJson("/api/invites/{$plain}/accept", [])
            ->assertOk();

        $this->assertTrue(
            Organization::query()->where('slug', 'acme')->firstOrFail()
                ->members()->where('users.id', $existing->id)->exists()
        );
        $this->assertSame('Existing', $existing->fresh()->name);
    }
}
