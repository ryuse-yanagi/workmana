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
