<?php

namespace Tests\Feature\Comments;

use App\Enums\MembershipRole;
use App\Models\AppNotification;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CommentEditNotifiesOnlyNewMentionsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_comment_edit_notifies_only_new_mentions_and_skips_duplicate_assignee_notify(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $another = User::factory()->create();
        $organization->members()->attach($another->id, ['role' => MembershipRole::Member->value]);

        $workspaceId = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Mentions'])
            ->assertCreated()
            ->json('id');

        $listId = (int) Workspace::query()->findOrFail($workspaceId)->lists()->orderBy('sort_order')->value('id');

        $taskId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks", [
                'title' => 'Mention task',
                'list_id' => $listId,
                'assignee_ids' => [$member->id],
            ])
            ->assertCreated()
            ->json('id');

        AppNotification::query()->where('user_id', $member->id)->delete();

        $commentId = (int) $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments", [
                'body' => 'ping @[user:'.$member->id.']',
            ])
            ->assertCreated()
            ->json('id');

        $this->assertSame(
            1,
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.mentioned')
                ->count()
        );
        $this->assertSame(
            0,
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.commented')
                ->count()
        );

        AppNotification::query()->where('user_id', $member->id)->delete();
        AppNotification::query()->where('user_id', $another->id)->delete();

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspaces/{$workspaceId}/tasks/{$taskId}/comments/{$commentId}", [
                'body' => 'ping @[user:'.$member->id.'] and @[user:'.$another->id.']',
            ])
            ->assertOk();

        $this->assertSame(
            0,
            AppNotification::query()
                ->where('user_id', $member->id)
                ->where('type', 'task.mentioned')
                ->count(),
            '既存メンションには再通知しない'
        );
        $this->assertSame(
            1,
            AppNotification::query()
                ->where('user_id', $another->id)
                ->where('type', 'task.mentioned')
                ->count(),
            '新規メンションのみ通知する'
        );
    }
}
