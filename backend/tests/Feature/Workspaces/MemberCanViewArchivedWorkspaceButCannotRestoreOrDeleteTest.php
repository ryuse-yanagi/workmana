<?php

namespace Tests\Feature\Workspaces;

use App\Enums\MembershipRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MemberCanViewArchivedWorkspaceButCannotRestoreOrDeleteTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** メンバーはアーカイブ済みワークスペースを閲覧できるが復元・削除はできない */
    public function test_member_can_view_archived_workspace_but_cannot_restore_or_delete(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create();
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Space',
                'assignee_ids' => [$admin->id, $member->id],
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/archive")
            ->assertOk();

        $this->actingAsApiUser($member)
            ->getJson('/api/orgs/acme/workspaces/archived')
            ->assertOk()
            ->assertJsonPath('data.0.id', $workspaceId);

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/unarchive")
            ->assertForbidden();

        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/workspaces/{$workspaceId}")
            ->assertForbidden();
    }
}
