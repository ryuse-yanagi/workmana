<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MemberGroupApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_member_groups(): void
    {
        $admin = User::factory()->create(['name' => 'Admin']);
        $memberA = User::factory()->create(['name' => 'Alice']);
        $memberB = User::factory()->create(['name' => 'Bob']);

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $org = \App\Models\Organization::query()->where('slug', 'acme')->firstOrFail();
        $org->members()->attach($memberA->id, ['role' => 'member', 'invited_by' => $admin->id]);
        $org->members()->attach($memberB->id, ['role' => 'member', 'invited_by' => $admin->id]);

        $createRes = $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->postJson('/api/orgs/acme/member-groups', [
                'name' => '開発',
                'color_index' => 2,
                'member_ids' => [$memberA->id],
            ])
            ->assertCreated()
            ->assertJsonPath('name', '開発')
            ->assertJsonPath('color_index', 2)
            ->assertJsonPath('members.0.id', $memberA->id);

        $groupId = $createRes->json('id');

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->getJson('/api/orgs/acme/member-groups')
            ->assertOk()
            ->assertJsonPath('data.0.name', '開発')
            ->assertJsonPath('data.0.members.0.id', $memberA->id);

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->patchJson("/api/orgs/acme/member-groups/{$groupId}", [
                'name' => 'デザイン',
                'color_index' => 5,
                'member_ids' => [$memberA->id, $memberB->id],
            ])
            ->assertOk()
            ->assertJsonPath('name', 'デザイン')
            ->assertJsonPath('color_index', 5)
            ->assertJsonPath('members.0.id', $memberA->id)
            ->assertJsonPath('members.1.id', $memberB->id);

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->patchJson("/api/orgs/acme/member-groups/{$groupId}/members/reorder", [
                'member_ids' => [$memberB->id, $memberA->id],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->getJson('/api/orgs/acme/member-groups')
            ->assertOk()
            ->assertJsonPath('data.0.members.0.id', $memberB->id)
            ->assertJsonPath('data.0.members.1.id', $memberA->id);

        $groupB = $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->postJson('/api/orgs/acme/member-groups', [
                'name' => '営業',
                'color_index' => 0,
                'member_ids' => [],
            ])
            ->assertCreated()
            ->json('id');

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->patchJson('/api/orgs/acme/member-groups/reorder', [
                'group_ids' => [$groupB, $groupId],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->getJson('/api/orgs/acme/member-groups')
            ->assertOk()
            ->assertJsonPath('data.0.id', $groupB)
            ->assertJsonPath('data.1.id', $groupId);

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->deleteJson("/api/orgs/acme/member-groups/{$groupId}")
            ->assertNoContent();

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->getJson('/api/orgs/acme/member-groups')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_member_ids_must_belong_to_organization(): void
    {
        $admin = User::factory()->create();
        $outsider = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$admin->id)
            ->postJson('/api/orgs/acme/member-groups', [
                'name' => '外部',
                'member_ids' => [$outsider->id],
            ])
            ->assertStatus(422);
    }
}
