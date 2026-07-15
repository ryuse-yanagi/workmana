<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentLabelCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_document_label_categories_and_labels(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $categoryRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/document-label-categories', [
                'name' => '種別',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '種別');

        $categoryId = $categoryRes->json('id');

        $labelRes = $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/document-labels', [
                'category_id' => $categoryId,
                'name' => '重要',
                'color_index' => 0,
            ])
            ->assertCreated()
            ->assertJsonPath('name', '重要')
            ->assertJsonPath('category_id', $categoryId);

        $labelId = $labelRes->json('id');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/document-label-categories')
            ->assertOk()
            ->assertJsonPath('data.0.name', '種別')
            ->assertJsonPath('data.0.labels.0.name', '重要');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/document-labels/{$labelId}", [
                'name' => '要確認',
            ])
            ->assertOk()
            ->assertJsonPath('name', '要確認');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->deleteJson("/api/orgs/acme/document-label-categories/{$categoryId}")
            ->assertNoContent();
    }
}
