<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class SearchDocumentsByNameTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 資料一覧の q は名前の部分一致。ヒットなしは空配列 */
    public function test_documents_can_be_searched_by_name(): void
    {
        [$admin, $organization] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($admin, 'acme', 'Docs');

        Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $admin->id,
            'name' => '要件定義書',
        ]);
        Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $admin->id,
            'name' => 'リリースノート',
        ]);

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/documents?q='.urlencode('要件'))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.name', '要件定義書');

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/documents?q=zzzz-no-match')
            ->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('data', []);
    }
}
