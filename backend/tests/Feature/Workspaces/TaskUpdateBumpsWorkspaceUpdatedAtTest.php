<?php

namespace Tests\Feature\Workspaces;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class TaskUpdateBumpsWorkspaceUpdatedAtTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_task_update_bumps_workspace_updated_at(): void
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

        $workspace = Workspace::query()->firstOrFail();
        $listId = $this->defaultListId($workspace);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks", [
                'title' => 'First task',
                'list_id' => $listId,
            ])
            ->assertCreated();

        $task = Task::query()->firstOrFail();
        $workspace->refresh();
        $baseline = $workspace->updated_at?->copy() ?? now();

        Carbon::setTestNow($baseline->copy()->addMinute());

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/workspaces/{$workspace->id}/tasks/{$task->id}", [
                'title' => 'Updated task',
            ])
            ->assertOk();

        $workspace->refresh();
        $this->assertTrue(
            $workspace->updated_at->greaterThan($baseline),
            'Workspace updated_at should bump when a task inside it changes.',
        );

        Carbon::setTestNow();
    }
}
