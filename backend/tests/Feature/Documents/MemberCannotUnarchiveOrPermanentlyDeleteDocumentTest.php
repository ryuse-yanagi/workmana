<?php

namespace Tests\Feature\Documents;

use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class MemberCannotUnarchiveOrPermanentlyDeleteDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 一般メンバーはアーカイブ済み資料の復元・完全削除ができない */
    public function test_member_cannot_unarchive_or_permanently_delete_document(): void
    {
        [$admin, $organization, $member] = $this->createOrgWithAdminAndMember();
        $workspaceId = $this->createWorkspaceViaApi($admin, 'acme', 'Docs');
        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $admin->id,
            'name' => 'Archived notes',
        ]);

        $this->actingAsApiUser($admin)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk();

        $this->actingAsApiUser($member)
            ->postJson("/api/orgs/acme/documents/{$document->id}/unarchive")
            ->assertForbidden();

        $this->actingAsApiUser($member)
            ->deleteJson("/api/orgs/acme/documents/{$document->id}")
            ->assertForbidden();

        $this->assertNotNull($document->fresh()->archived_at);
        $this->assertDatabaseHas('shared_documents', ['id' => $document->id]);
    }
}
