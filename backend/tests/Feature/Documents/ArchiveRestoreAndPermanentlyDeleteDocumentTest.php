<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ArchiveRestoreAndPermanentlyDeleteDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者は資料をアーカイブ・復元・完全削除できる。同じスペースの別資料とスペース自体は残る */
    public function test_document_can_be_archived_restored_and_permanently_deleted(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Linked space');
        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => 'Design notes',
        ]);
        $sibling = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => 'Survivor notes',
        ]);

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertUnprocessable();

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk()
            ->assertJsonPath('name', 'Design notes');

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents')
            ->assertJsonMissing(['id' => $document->id]);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents/archived')
            ->assertJsonPath('data.0.id', $document->id);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/workspaces/{$workspaceId}/documents/archived")
            ->assertOk()
            ->assertJsonPath('data.0.id', $document->id);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/unarchive")
            ->assertOk()
            ->assertJsonPath('archived_at', null);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('shared_documents', ['id' => $document->id]);
        $this->assertDatabaseHas('shared_documents', ['id' => $sibling->id]);
        $this->assertDatabaseHas('workspaces', ['id' => $workspaceId]);
    }
}
