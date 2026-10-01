<?php

namespace Tests\Feature\Workspaces;

use App\Models\Organization\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class NonMemberCannotAccessOrgTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 非メンバーは組織にアクセスできない */
    public function test_non_member_cannot_access_org(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $org = Organization::query()->create([
            'name' => 'Closed',
            'slug' => 'closed',
            'created_by' => $owner->id,
        ]);
        $org->members()->attach($owner->id, ['role' => 'admin']);

        $this->actingAsApiUser($other)
            ->getJson('/api/orgs/closed/workspaces')
            ->assertForbidden();
    }
}
