<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ShowDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者は資料の詳細（本文含む）を取得できる */
    public function test_admin_can_show_shared_document(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Docs');

        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'description' => 'REST API の設計方針',
            'body' => '資料本文',
        ]);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('id', $document->id)
            ->assertJsonPath('name', 'API 設計')
            ->assertJsonPath('description', 'REST API の設計方針')
            ->assertJsonPath('body', '資料本文');
    }
}
