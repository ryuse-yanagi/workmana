<?php

namespace Tests\Feature\Labels;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ManageTaskLabelsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_admin_can_manage_task_label_categories_and_labels(): void
    {
        $user = User::factory()->create();

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $categoryRes = $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/task-label-categories', [
                'name' => '工程',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '工程');

        $categoryId = $categoryRes->json('id');

        $labelRes = $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/task-labels', [
                'category_id' => $categoryId,
                'name' => '設計',
                'color_index' => 0,
            ])
            ->assertCreated()
            ->assertJsonPath('name', '設計')
            ->assertJsonPath('category_id', $categoryId);

        $labelId = $labelRes->json('id');

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/task-label-categories')
            ->assertOk()
            ->assertJsonPath('data.0.name', '工程')
            ->assertJsonPath('data.0.labels.0.name', '設計');

        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/acme/task-labels/{$labelId}", [
                'name' => '実装',
            ])
            ->assertOk()
            ->assertJsonPath('name', '実装');

        $categoryB = $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/task-label-categories', [
                'name' => '優先度',
            ])
            ->assertCreated()
            ->json('id');

        $labelB = $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/task-labels', [
                'category_id' => $categoryId,
                'name' => 'レビュー',
                'color_index' => 1,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/task-label-categories/reorder', [
                'category_ids' => [$categoryB, $categoryId],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/task-label-categories')
            ->assertOk()
            ->assertJsonPath('data.0.id', $categoryB)
            ->assertJsonPath('data.1.id', $categoryId);

        $this->actingAsApiUser($user)
            ->patchJson('/api/orgs/acme/task-labels/reorder', [
                'category_id' => $categoryId,
                'label_ids' => [$labelB, $labelId],
            ])
            ->assertOk()
            ->assertJsonPath('data.ok', true);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/task-label-categories')
            ->assertOk()
            ->assertJsonPath('data.1.labels.0.id', $labelB)
            ->assertJsonPath('data.1.labels.1.id', $labelId);

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/task-labels/{$labelId}")
            ->assertNoContent();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/task-label-categories/{$categoryId}")
            ->assertNoContent();
    }
}
