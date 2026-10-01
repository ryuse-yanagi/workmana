<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListDocumentsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者の資料一覧は未アーカイブの資料を返し、アーカイブ済みは含めない */
    public function test_admin_document_index_lists_active_documents_and_excludes_archived(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Docs');

        $active = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => '公開中',
        ]);
        $archived = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => '保管済み',
        ]);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$archived->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $active->id)
            ->assertJsonPath('data.0.name', '公開中');
    }
}
