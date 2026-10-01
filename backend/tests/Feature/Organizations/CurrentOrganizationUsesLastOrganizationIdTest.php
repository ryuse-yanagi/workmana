<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CurrentOrganizationUsesLastOrganizationIdTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 複数所属時はlast_organization_idの組織が現在組織になる */
    public function test_current_organization_uses_last_organization_id_when_multiple(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-2']);
        $first = $this->createOrganizationForUser($user, 'First', 'first');
        $second = $this->createOrganizationForUser($user, 'Second', 'second');
        $user->last_organization_id = $second->id;
        $user->save();

        $this->actingAsApiUser($user)
            ->getJson('/api/me/current-organization')
            ->assertOk()
            ->assertJsonPath('organization.slug', 'second');

        $user->last_organization_id = null;
        $user->save();

        $this->actingAsApiUser($user)
            ->getJson('/api/me/current-organization')
            ->assertOk()
            ->assertJsonPath('organization.slug', 'first');

        $user->refresh();
        $this->assertSame($first->id, $user->last_organization_id);
    }
}
