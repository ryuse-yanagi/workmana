<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabelCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_task_label_categories_and_labels(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $categoryRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/task-label-categories', [
                'name' => '工程',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '工程');

        $categoryId = $categoryRes->json('id');

        $labelRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/task-labels', [
                'category_id' => $categoryId,
                'name' => '設計',
                'color_index' => 0,
            ])
            ->assertCreated()
            ->assertJsonPath('name', '設計')
            ->assertJsonPath('category_id', $categoryId);

        $labelId = $labelRes->json('id');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/task-label-categories')
            ->assertOk()
            ->assertJsonPath('data.0.name', '工程')
            ->assertJsonPath('data.0.labels.0.name', '設計');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/task-labels/{$labelId}", [
                'name' => '実装',
            ])
            ->assertOk()
            ->assertJsonPath('name', '実装');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->deleteJson("/api/orgs/acme/task-labels/{$labelId}")
            ->assertNoContent();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->deleteJson("/api/orgs/acme/task-label-categories/{$categoryId}")
            ->assertNoContent();
    }
}
