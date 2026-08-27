<?php

namespace Tests\Feature\Tasks;

use App\Enums\MembershipRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class OrgMemberCanBeTaskAssigneeAndListedInWorkspaceMembersTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_org_member_can_be_task_assignee_and_listed_in_workspace_members(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $member = User::factory()->create(['name' => 'Teammate']);
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Open space',
            ])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Assigned work',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->assertJsonPath('assignees.0.id', $member->id);

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/members")
            ->assertOk()
            ->assertJsonFragment(['id' => $member->id]);
    }
}
