<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CurrentOrganizationNullWhenNoMembershipsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    public function test_current_organization_null_when_no_memberships(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-3']);

        $this->actingAsApiUser($user)
            ->getJson('/api/me/current-organization')
            ->assertOk()
            ->assertJsonPath('organization', null);
    }
}
