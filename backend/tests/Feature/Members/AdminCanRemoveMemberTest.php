<?php

namespace Tests\Feature\Members;

use App\Enums\MembershipRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanRemoveMemberTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_admin_can_remove_member(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/members/{$member->id}")
            ->assertNoContent();

        $this->assertFalse($organization->members()->where('users.id', $member->id)->exists());
    }
}
