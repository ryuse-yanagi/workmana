<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateOrganizationAttachesAdminTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    public function test_create_organization_attaches_admin_and_sets_last_organization(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-1']);

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => '新しい組織',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '新しい組織')
            ->assertJsonStructure(['id', 'name', 'slug']);

        $user->refresh();
        $this->assertSame(1, $user->organizations()->count());
        $this->assertSame('admin', $user->organizations()->first()->pivot->role);
        $this->assertNotNull($user->last_organization_id);
        $this->assertSame($user->organizations()->first()->id, $user->last_organization_id);
    }
}
