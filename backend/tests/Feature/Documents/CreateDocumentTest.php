<?php

namespace Tests\Feature\Documents;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class CreateDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 一般メンバーでも資料を作成できる */
    public function test_organization_member_can_create_shared_document(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $workspaceId = $this->createWorkspaceViaApi($admin, 'acme', 'Docs');

        $created = $this->actingAsApiUser($member)
            ->postJson('/api/orgs/acme/documents', [
                'workspace_id' => $workspaceId,
                'name' => '新規資料',
                'description' => '資料の説明',
                'category' => 'その他',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '新規資料')
            ->assertJsonPath('description', '資料の説明')
            ->assertJsonPath('category.name', 'その他');

        $documentId = (int) $created->json('id');

        $this->assertDatabaseHas('shared_documents', [
            'id' => $documentId,
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $member->id,
            'name' => '新規資料',
            'description' => '資料の説明',
            'category' => 'その他',
        ]);

        $this->actingAsApiUser($admin)
            ->getJson("/api/orgs/acme/documents/{$documentId}")
            ->assertOk()
            ->assertJsonPath('id', $documentId);
    }
}
