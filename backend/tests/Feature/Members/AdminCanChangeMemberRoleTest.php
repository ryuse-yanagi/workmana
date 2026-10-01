<?php

namespace Tests\Feature\Members;

use App\Enums\MembershipRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class AdminCanChangeMemberRoleTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者はメンバーを管理者へ昇格でき、一覧の role にも反映される */
    public function test_admin_can_change_member_role(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/members/{$member->id}", ['role' => 'admin'])
            ->assertOk()
            ->assertJsonPath('role', 'admin');

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/members')
            ->assertOk()
            ->assertJsonFragment(['id' => $member->id, 'role' => 'admin']);
    }

    /** 一般メンバーは他人のロールを変更できない */
    public function test_member_cannot_change_another_members_role(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $other = User::factory()->create();
        $organization->members()->attach($other->id, ['role' => MembershipRole::Member->value]);

        $this->actingAsApiUser($member)
            ->patchJson("/api/orgs/acme/members/{$other->id}", ['role' => 'admin'])
            ->assertForbidden();

        $this->assertDatabaseHas('memberships', [
            'organization_id' => $organization->id,
            'user_id' => $other->id,
            'role' => MembershipRole::Member->value,
        ]);
    }

    /** 最後の管理者は自分を一般メンバーへ降格できない */
    public function test_last_admin_cannot_demote_self(): void
    {
        [$admin] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/members/{$admin->id}", ['role' => 'member'])
            ->assertUnprocessable()
            ->assertJsonPath('message', '最後の管理者のロールは変更できません。');
    }
}
