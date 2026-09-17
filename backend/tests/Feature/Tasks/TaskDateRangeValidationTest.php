<?php

namespace Tests\Feature\Tasks;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class TaskDateRangeValidationTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_create_rejects_due_date_before_start_date(): void
    {
        [$user, $workspace] = $this->createWorkspaceReadyForTasks();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Bad range',
                'list_id' => $this->defaultListId($workspace),
                'start_date' => '2026-04-10',
                'due_date' => '2026-04-01',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'End date must be on or after start date.');
    }

    public function test_update_rejects_due_date_before_existing_start_date(): void
    {
        [$user, $workspace] = $this->createWorkspaceReadyForTasks();

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
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}", [
                'due_date' => '2026-04-01',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'End date must be on or after start date.');
    }

    public function test_update_rejects_start_date_after_existing_due_date(): void
    {
        [$user, $workspace] = $this->createWorkspaceReadyForTasks();

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
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}", [
                'start_date' => '2026-04-20',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'End date must be on or after start date.');
    }

    public function test_same_day_start_and_due_is_allowed(): void
    {
        [$user, $workspace] = $this->createWorkspaceReadyForTasks();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'Same day',
                'list_id' => $this->defaultListId($workspace),
                'start_date' => '2026-04-10',
                'due_date' => '2026-04-10',
            ])
            ->assertCreated();
    }

    /**
     * @return array{0: User, 1: Workspace}
     */
    private function createWorkspaceReadyForTasks(): array
    {
        $user = User::factory()->create();

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $workspace = Workspace::query()->first();
        $this->assertNotNull($workspace);

        return [$user, $workspace];
    }
}

