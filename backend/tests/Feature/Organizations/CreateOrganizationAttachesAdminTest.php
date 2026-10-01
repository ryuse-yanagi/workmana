<?php

namespace Tests\Feature\Organizations;

use App\Models\User;
use App\Support\Organization\OrganizationSlug;
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

    /** 組織作成で作成者が管理者になり現在組織が設定される */
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
        $this->assertMatchesRegularExpression(
            OrganizationSlug::PATTERN,
            (string) $user->organizations()->first()->slug,
        );
    }

    /** 同じ組織名でも別コードになり、リクエストの slug は使わない */
    public function test_create_organization_assigns_unique_random_slug_and_ignores_requested_slug(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-2']);

        $first = $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => '同じ名前',
                'slug' => 'custom-slug',
            ])
            ->assertCreated()
            ->json('slug');

        $second = $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => '同じ名前',
            ])
            ->assertCreated()
            ->json('slug');

        $this->assertMatchesRegularExpression(OrganizationSlug::PATTERN, (string) $first);
        $this->assertMatchesRegularExpression(OrganizationSlug::PATTERN, (string) $second);
        $this->assertNotSame($first, $second);
        $this->assertNotSame('custom-slug', $first);
    }
}
