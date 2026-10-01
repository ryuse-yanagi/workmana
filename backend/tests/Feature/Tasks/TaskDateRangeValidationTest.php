<?php

namespace Tests\Feature\Tasks;

use App\Models\Task\Task;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class TaskDateRangeValidationTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 開始日より前の期限では作成できない */
    public function test_create_rejects_due_date_before_start_date(): void
    {
        [$user, $workspace, $slug] = $this->createWorkspaceReadyForTasks();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Bad range',
                'list_id' => $this->defaultListId($workspace),
                'start_date' => '2026-04-10',
                'due_date' => '2026-04-01',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'End date must be on or after start date.');
    }

    /** 既存の開始日より前の期限では更新できない */
    public function test_update_rejects_due_date_before_existing_start_date(): void
    {
        [$user, $workspace, $slug] = $this->createWorkspaceReadyForTasks();

        $task = Task::query()->create([
            'organization_id' => $workspace->organization_id,
            'workspace_id' => $workspace->id,
            'list_id' => $this->defaultListId($workspace),
            'sort_order' => 0,
            'title' => 'Dated task',
            'priority' => 'medium',
            'start_date' => '2026-04-10',
            'due_date' => null,
            'reporter_id' => $user->id,
        ]);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$task->id}", [
                'due_date' => '2026-04-01',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'End date must be on or after start date.');
    }

    /** 既存の期限より後の開始日では更新できない */
    public function test_update_rejects_start_date_after_existing_due_date(): void
    {
        [$user, $workspace, $slug] = $this->createWorkspaceReadyForTasks();

        $task = Task::query()->create([
            'organization_id' => $workspace->organization_id,
            'workspace_id' => $workspace->id,
            'list_id' => $this->defaultListId($workspace),
            'sort_order' => 0,
            'title' => 'Dated task',
            'priority' => 'medium',
            'start_date' => null,
            'due_date' => '2026-04-10',
            'reporter_id' => $user->id,
        ]);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$task->id}", [
                'start_date' => '2026-04-20',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'End date must be on or after start date.');
    }

    /** 開始日と期限が同日なら作成できる */
    public function test_same_day_start_and_due_is_allowed(): void
    {
        [$user, $workspace, $slug] = $this->createWorkspaceReadyForTasks();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Same day',
                'list_id' => $this->defaultListId($workspace),
                'start_date' => '2026-04-10',
                'due_date' => '2026-04-10',
            ])
            ->assertCreated();
    }

    /**
     * @return array{0: User, 1: Workspace, 2: string}
     */
    private function createWorkspaceReadyForTasks(): array
    {
        $user = User::factory()->create();
        $slug = $this->createOrganizationViaApi($user);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces", [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);

        return [$user, $workspace, $slug];
    }
}
