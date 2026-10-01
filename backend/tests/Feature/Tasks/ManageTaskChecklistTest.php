<?php

namespace Tests\Feature\Tasks;

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ManageTaskChecklistTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** タスクのチェックリストは追加・完了トグル・全削除できる */
    public function test_user_can_manage_task_checklist(): void
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

        $taskId = (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks", [
                'title' => 'Checklist task',
                'list_id' => $this->defaultListId($workspace),
            ])
            ->assertCreated()
            ->json('id');

        $itemId = '11111111-1111-4111-8111-111111111111';
        $itemId2 = '22222222-2222-4222-8222-222222222222';

        $createResponse = $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'checklists' => [
                    [
                        'title' => 'Release prep',
                        'items' => [
                            [
                                'id' => $itemId,
                                'text' => 'Review PR',
                                'checked' => false,
                            ],
                        ],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('checklists.0.title', 'Release prep')
            ->assertJsonPath('checklists.0.items.0.id', $itemId)
            ->assertJsonPath('checklists.0.items.0.text', 'Review PR')
            ->assertJsonPath('checklists.0.items.0.checked', false);

        $checklistId = $createResponse->json('checklists.0.id');
        $this->assertIsInt($checklistId);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}")
            ->assertOk()
            ->assertJsonPath('checklists.0.title', 'Release prep')
            ->assertJsonPath('checklists.0.items.0.checked', false);

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'checklists' => [
                    [
                        'id' => $checklistId,
                        'title' => 'Release prep',
                        'items' => [
                            [
                                'id' => $itemId,
                                'text' => 'Review PR',
                                'checked' => true,
                            ],
                        ],
                    ],
                    [
                        'title' => 'QA',
                        'items' => [
                            [
                                'id' => $itemId2,
                                'text' => 'Smoke test',
                                'checked' => false,
                            ],
                        ],
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('checklists.0.items.0.checked', true)
            ->assertJsonPath('checklists.1.title', 'QA')
            ->assertJsonPath('checklists.1.items.0.text', 'Smoke test')
            ->assertJsonCount(2, 'checklists');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$slug}/workspaces/{$workspace->id}/tasks/{$taskId}", [
                'checklists' => [],
            ])
            ->assertOk()
            ->assertJsonPath('checklists', []);
    }
}
