<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class SwitchOrganizationUpdatesLastOrganizationIdTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 組織切替でlast_organization_idが更新される */
    public function test_switch_organization_updates_last_organization_id(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-4']);
        $this->createOrganizationForUser($user, 'Alpha', 'alpha');
        $beta = $this->createOrganizationForUser($user, 'Beta', 'beta');

        $this->actingAsApiUser($user)
            ->putJson('/api/me/current-organization', ['slug' => 'beta'])
            ->assertOk()
            ->assertJsonPath('organization.slug', 'beta');

        $user->refresh();
        $this->assertSame($beta->id, $user->last_organization_id);
    }
}
