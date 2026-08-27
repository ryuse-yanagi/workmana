<?php

namespace Tests\Feature\Documents;

use App\Models\SharedDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ShowSharedDocumentTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_member_can_show_shared_document(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'description' => 'REST API の設計方針',
            'body' => '資料本文',
        ]);

        $this->actingAsApiUser($user)
            ->getJson("/api/orgs/acme/documents/{$document->id}")
            ->assertOk()
            ->assertJsonPath('name', 'API 設計')
            ->assertJsonPath('description', 'REST API の設計方針')
            ->assertJsonPath('body', '資料本文');
    }
}
