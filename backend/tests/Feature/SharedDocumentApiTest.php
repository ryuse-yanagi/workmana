<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SharedDocumentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_member_can_list_shared_documents(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_document_index_includes_description_and_body(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'description' => 'REST API の設計方針',
            'body' => '資料本文',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'API 設計')
            ->assertJsonPath('data.0.description', 'REST API の設計方針')
            ->assertJsonPath('data.0.body', '資料本文');
    }

    public function test_organization_member_can_show_shared_document(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'description' => 'REST API の設計方針',
            'body' => '資料本文',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson("/api/orgs/acme/documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('name', 'API 設計')
            ->assertJsonPath('description', 'REST API の設計方針')
            ->assertJsonPath('body', '資料本文');
    }

    public function test_organization_member_can_create_shared_document(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/orgs/acme/documents', [
                'name' => '新規資料',
                'description' => '資料の説明',
                'category' => 'その他',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '新規資料')
            ->assertJsonPath('description', '資料の説明')
            ->assertJsonPath('category.name', 'その他');

        $this->assertDatabaseHas('shared_documents', [
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => '新規資料',
            'description' => '資料の説明',
            'category' => 'その他',
        ]);
    }

    public function test_organization_member_can_update_document_category(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_document_category_names' => [
                ['name' => '仕様書', 'color_index' => 1],
                ['name' => 'その他', 'color_index' => 5],
            ],
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => '設計資料',
            'category' => 'その他',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/documents/{$document->id}", [
                'category' => '仕様書',
            ])
            ->assertOk()
            ->assertJsonPath('category.name', '仕様書');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'category' => '仕様書',
        ]);
    }

    public function test_organization_member_can_update_shared_document(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
            'default_document_category_names' => [
                ['name' => '仕様書', 'color_index' => 1],
                ['name' => 'その他', 'color_index' => 5],
            ],
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => '設計資料',
            'description' => '旧説明',
            'category' => 'その他',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson("/api/orgs/acme/documents/{$document->id}", [
                'name' => '更新後の資料',
                'description' => '新説明',
                'body' => '更新後の本文',
                'category' => '仕様書',
                'label_ids' => [],
            ])
            ->assertOk()
            ->assertJsonPath('name', '更新後の資料')
            ->assertJsonPath('description', '新説明')
            ->assertJsonPath('body', '更新後の本文')
            ->assertJsonPath('category.name', '仕様書');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $document->id,
            'name' => '更新後の資料',
            'description' => '新説明',
            'body' => '更新後の本文',
            'category' => '仕様書',
        ]);
    }

    public function test_organization_member_can_permanently_delete_archived_shared_document(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => '削除対象',
        ]);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('shared_documents', [
            'id' => $document->id,
        ]);
    }
}
