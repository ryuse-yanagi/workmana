<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class SessionIncludesLastOrganizationIdTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** セッションにlast_organization_idが含まれる */
    public function test_session_includes_last_organization_id(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-7']);
        $org = $this->createOrganizationForUser($user, 'Acme', 'acme');
        $user->last_organization_id = $org->id;
        $user->save();

        $this->actingAsApiUser($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('user.last_organization_id', $org->id);
    }
}
