<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationTaskApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_organization_project_and_task(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated()
            ->assertJsonPath('slug', 'acme');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Sprint 1');

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'First task',
                'status' => 'todo',
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'First task');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'effort_hours' => 8.5,
            ])
            ->assertOk()
            ->assertJsonPath('effort_value', '8.5000')
            ->assertJsonPath('effort_unit', 'hour');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'effort_value' => 4,
                'effort_unit' => 'minute',
            ])
            ->assertOk()
            ->assertJsonPath('effort_value', '4.0000')
            ->assertJsonPath('effort_unit', 'minute')
            ->assertJsonPath('effort_hours', '0.066667');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks")
            ->assertOk()
            ->assertJsonPath('data.0.effort_value', '4.0000')
            ->assertJsonPath('data.0.effort_unit', 'minute')
            ->assertJsonPath('data.0.effort_hours', '0.066667');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'description' => 'WBS note',
            ])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.description', 'WBS note')
            ->assertJsonPath('data.0.list_name', null);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'effort_hours' => null,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', null)
            ->assertJsonPath('effort_unit', null);
    }

    public function test_user_can_reorder_wbs_tasks(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Parent task',
                'status' => 'todo',
                'is_parent_task' => true,
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Child task',
                'status' => 'todo',
                'parent_task_id' => 1,
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Standalone task',
                'status' => 'todo',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => 3, 'sort_order' => 0, 'parent_task_id' => null],
                    ['id' => 1, 'sort_order' => 1, 'parent_task_id' => null],
                    ['id' => 2, 'sort_order' => 2, 'parent_task_id' => 1],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.id', 3)
            ->assertJsonPath('data.1.id', 1)
            ->assertJsonPath('data.2.id', 2)
            ->assertJsonPath('data.2.parent_task_id', 1);
    }

    public function test_changing_task_list_preserves_wbs_sort_order(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $lists = $project->lists()->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $lists->count());
        $firstList = $lists[0];
        $secondList = $lists[1];

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Task A',
                'status' => 'todo',
                'list_id' => $firstList->id,
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Task B',
                'status' => 'todo',
                'list_id' => $secondList->id,
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Task C',
                'status' => 'todo',
                'list_id' => $firstList->id,
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs/reorder", [
                'tasks' => [
                    ['id' => 1, 'sort_order' => 0, 'parent_task_id' => null],
                    ['id' => 2, 'sort_order' => 1, 'parent_task_id' => null],
                    ['id' => 3, 'sort_order' => 2, 'parent_task_id' => null],
                ],
            ])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/2", [
                'list_id' => $firstList->id,
            ])
            ->assertOk()
            ->assertJsonPath('list_id', $firstList->id)
            ->assertJsonPath('sort_order', 1);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('data.0.id', 1)
            ->assertJsonPath('data.1.id', 2)
            ->assertJsonPath('data.2.id', 3);
    }

    public function test_user_can_create_parent_and_child_tasks(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Parent task',
                'status' => 'todo',
                'is_parent_task' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Parent task')
            ->assertJsonPath('is_parent_task', true)
            ->assertJsonPath('parent_task_id', null);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/parents")
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Parent task');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Child task',
                'status' => 'todo',
                'parent_task_id' => 1,
            ])
            ->assertCreated()
            ->assertJsonPath('title', 'Child task')
            ->assertJsonPath('is_parent_task', false)
            ->assertJsonPath('parent_task_id', 1);
    }

    public function test_user_can_update_wbs_orphan_parent_label(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('meta.orphan_parent_label', '親タスクなし');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs/orphan-parent-label", [
                'label' => '未分類タスク',
            ])
            ->assertOk()
            ->assertJsonPath('data.orphan_parent_label', '未分類タスク');

        $this->assertSame('未分類タスク', $project->fresh()?->wbs_orphan_parent_label);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/wbs")
            ->assertOk()
            ->assertJsonPath('meta.orphan_parent_label', '未分類タスク');
    }

    public function test_user_can_manage_task_checklist(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/tasks", [
                'title' => 'Checklist task',
                'status' => 'todo',
            ])
            ->assertCreated();

        $itemId = '11111111-1111-4111-8111-111111111111';

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'checklist' => [
                    'title' => 'Release prep',
                    'items' => [
                        [
                            'id' => $itemId,
                            'text' => 'Review PR',
                            'checked' => false,
                        ],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('checklist.title', 'Release prep')
            ->assertJsonPath('checklist.items.0.id', $itemId)
            ->assertJsonPath('checklist.items.0.text', 'Review PR')
            ->assertJsonPath('checklist.items.0.checked', false);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/tasks/1")
            ->assertOk()
            ->assertJsonPath('checklist.title', 'Release prep')
            ->assertJsonPath('checklist.items.0.checked', false);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'checklist' => [
                    'title' => 'Release prep',
                    'items' => [
                        [
                            'id' => $itemId,
                            'text' => 'Review PR',
                            'checked' => true,
                        ],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('checklist.items.0.checked', true);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'checklist' => null,
            ])
            ->assertOk()
            ->assertJsonPath('checklist', null);
    }

    public function test_non_member_cannot_access_org(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $org = Organization::query()->create([
            'name' => 'Closed',
            'slug' => 'closed',
            'created_by' => $owner->id,
        ]);
        $org->members()->attach($owner->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$other->id)
            ->getJson('/api/orgs/closed/projects')
            ->assertForbidden();
    }
}
