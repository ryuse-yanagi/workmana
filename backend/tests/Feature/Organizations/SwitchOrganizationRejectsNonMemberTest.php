<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class SwitchOrganizationRejectsNonMemberTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    public function test_switch_organization_rejects_non_member(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-5']);
        $other = User::factory()->create(['cognito_sub' => 'sub-6']);
        $this->createOrganizationForUser($other, 'Other', 'other');

        $this->actingAsApiUser($user)
            ->putJson('/api/me/current-organization', ['slug' => 'other'])
            ->assertForbidden();
    }
}
