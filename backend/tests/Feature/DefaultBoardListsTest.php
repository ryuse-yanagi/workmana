<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use App\Support\DefaultBoardLists;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DefaultBoardListsTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_creation_seeds_default_board_lists(): void
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
            ->getJson("/api/orgs/acme/projects/{$project->id}/lists")
            ->assertOk()
            ->assertJsonPath('data.0.name', '未着手')
            ->assertJsonPath('data.1.name', '進行中')
            ->assertJsonPath('data.2.name', '完了');
    }

    public function test_project_creation_uses_organization_default_board_list_settings(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_board_list_names' => ['Backlog', 'Review'],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/lists")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Backlog')
            ->assertJsonPath('data.1.name', 'Review');
    }

    public function test_empty_default_board_list_settings_create_no_lists(): void
    {
        $user = User::factory()->create();
        $org = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_board_list_names' => [],
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/projects', [
                'name' => 'Sprint 1',
            ])
            ->assertCreated();

        $project = Project::query()->first();
        $this->assertNotNull($project);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/projects/{$project->id}/lists")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_admin_can_update_default_board_list_settings(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonPath('default_board_list_names', DefaultBoardLists::DEFAULT_NAMES);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson('/api/orgs/acme/settings', [
                'default_board_list_names' => ['To Do', 'Doing', 'Done'],
            ])
            ->assertOk()
            ->assertJsonPath('default_board_list_names', ['To Do', 'Doing', 'Done']);
    }
}
