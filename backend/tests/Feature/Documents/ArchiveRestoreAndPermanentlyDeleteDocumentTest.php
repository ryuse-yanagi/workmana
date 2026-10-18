<?php

namespace Tests\Feature\Documents;

use App\Events\Organization\OrganizationChanged;
use App\Models\Document\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
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

    /** アーカイブと復元の配信は本文を載せない。本文ごと送るとサイズ上限で他画面へ届かない */
    public function test_archive_and_restore_broadcast_without_document_body(): void
    {
        Event::fake([OrganizationChanged::class]);

        [$user, $organization] = $this->createOrgWithAdmin();
        $workspaceId = $this->createWorkspaceViaApi($user, 'acme', 'Linked space');
        $document = Document::query()->create([
            'organization_id' => $organization->id,
            'workspace_id' => $workspaceId,
            'created_by' => $user->id,
            'name' => 'Design notes',
            'description' => 'Short',
            'body' => str_repeat('あ', 8000),
        ]);

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/archive")
            ->assertOk()
            ->assertJsonPath('body', $document->body);

        Event::assertDispatched(OrganizationChanged::class, function (OrganizationChanged $event) use ($document) {
            $payload = $event->broadcastWith()['document'] ?? null;

            return $event->type === 'document.archived'
                && is_array($payload)
                && (int) ($payload['id'] ?? 0) === (int) $document->id
                && ($payload['name'] ?? null) === 'Design notes'
                && (int) ($payload['workspace_id'] ?? 0) === (int) $document->workspace_id
                && ! array_key_exists('body', $payload);
        });

        $this->actingAsApiUser($user)
            ->postJson("/api/orgs/acme/documents/{$document->id}/unarchive")
            ->assertOk();

        Event::assertDispatched(OrganizationChanged::class, function (OrganizationChanged $event) use ($document) {
            $payload = $event->broadcastWith()['document'] ?? null;

            return $event->type === 'document.restored'
                && is_array($payload)
                && (int) ($payload['id'] ?? 0) === (int) $document->id
                && array_key_exists('archived_at', $payload)
                && $payload['archived_at'] === null
                && ! array_key_exists('body', $payload);
        });
    }
}
