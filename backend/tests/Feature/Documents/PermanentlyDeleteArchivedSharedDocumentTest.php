<?php

namespace Tests\Feature\Documents;

use App\Models\SharedDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class PermanentlyDeleteArchivedSharedDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_member_can_permanently_delete_archived_shared_document(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => '削除対象',
        ]);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($user)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('shared_documents', [
            'id' => $document->id,
        ]);
    }
}
