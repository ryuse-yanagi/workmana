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

    /** 管理者がメンバーを削除できる */
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

    /** 一般メンバーは他メンバーを削除できない */
    public function test_member_cannot_remove_another_member(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $other = User::factory()->create();
        $organization->members()->attach($other->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/members/{$other->id}")
            ->assertForbidden();

        $this->assertTrue($organization->members()->where('users.id', $other->id)->exists());
        $this->assertTrue($organization->members()->where('users.id', $admin->id)->exists());
    }

    /** 管理者は自分自身を削除できない */
    public function test_admin_cannot_remove_self(): void
    {
        [$admin] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/members/{$admin->id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', '自分自身を削除することはできません。別の管理者に依頼してください。');
    }
}
