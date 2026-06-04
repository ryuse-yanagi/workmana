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

        $headingRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/projects/{$project->id}/task-headings", [
                'name' => 'Phase 1',
            ])
            ->assertCreated()
            ->assertJsonPath('name', 'Phase 1');

        $headingId = $headingRes->json('id');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'task_heading_id' => $headingId,
            ])
            ->assertOk()
            ->assertJsonPath('heading.name', 'Phase 1')
            ->assertJsonPath('task_heading_id', $headingId);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'task_heading_id' => null,
            ])
            ->assertOk()
            ->assertJsonPath('heading', null)
            ->assertJsonPath('task_heading_id', null);

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
            ->patchJson("/api/orgs/acme/projects/{$project->id}/tasks/1", [
                'effort_hours' => null,
            ])
            ->assertOk()
            ->assertJsonPath('effort_hours', null)
            ->assertJsonPath('effort_unit', null);
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
