<?php

namespace Tests\Feature\Documents;

use App\Models\SharedDocument;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ArchiveRestoreAndPermanentlyDeleteDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_document_can_be_archived_restored_and_permanently_deleted(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();
        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'Design notes',
        ]);
        $relatedDocument = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'Survivor notes',
        ]);

        $this->actingAsApiUser($user)
            ->postJson('/api/orgs/acme/workspaces', ['name' => 'Linked space'])
            ->assertCreated();
        $workspace = Workspace::query()->firstOrFail();

        $this->actingAsApiUser($user)
            ->putJson("/api/orgs/acme/documents/{$document->id}/related-documents", [
                'document_ids' => [$relatedDocument->id],
            ])
            ->assertOk();

        $this->actingAsApiUser($user)
            ->putJson("/api/orgs/acme/documents/{$document->id}/related-workspaces", [
                'workspace_ids' => [$workspace->id],
            ])
            ->assertOk();

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
        $this->assertDatabaseMissing('document_document_label', ['shared_document_id' => $document->id]);
        $this->assertDatabaseMissing('document_related_document', ['document_id' => $document->id]);
        $this->assertDatabaseMissing('document_related_document', ['related_document_id' => $document->id]);
        $this->assertDatabaseMissing('workspace_related_document', ['shared_document_id' => $document->id]);

        // 関連先は削除されない
        $this->assertDatabaseHas('shared_documents', ['id' => $relatedDocument->id]);
        $this->assertDatabaseHas('workspaces', ['id' => $workspace->id]);
    }
}
