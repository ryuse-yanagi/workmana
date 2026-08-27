<?php

namespace Tests\Feature\Documents;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateSharedDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_member_can_create_shared_document(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
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
}
