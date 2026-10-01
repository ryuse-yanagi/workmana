<?php

namespace Tests\Feature\BoardLists;

use App\Events\List\ListsReordered;
use App\Models\User;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ReorderListsBroadcastsEventTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** リスト並び替え時にイベントがブロードキャストされる */
    public function test_reorder_lists_broadcasts_event(): void
    {
        Event::fake([ListsReordered::class]);

        $user = User::factory()->create();

        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/lists", [
                'name' => 'Todo',
                'color_index' => 0,
            ])
            ->assertCreated();

        $listB = $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/lists", [
                'name' => 'Doing',
                'color_index' => 1,
            ])
            ->assertCreated()
            ->json('id');

        $listIds = [(int) $listB, ...BoardList::query()
            ->where('workspace_id', $workspace->id)
            ->where('id', '!=', $listB)
            ->pluck('id')
            ->all()];

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/lists/reorder", [
                'list_ids' => $listIds,
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        Event::assertDispatched(ListsReordered::class, function (ListsReordered $event) use ($workspace, $listIds) {
            return $event->workspaceId === (int) $workspace->id
                && $event->listIds === $listIds;
        });
    }
}
