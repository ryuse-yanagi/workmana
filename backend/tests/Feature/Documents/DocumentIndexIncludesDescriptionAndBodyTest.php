<?php

namespace Tests\Feature\Documents;

use App\Models\SharedDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DocumentIndexIncludesDescriptionAndBodyTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_document_index_includes_description_and_body(): void
    {
        [$user, $organization] = $this->createOrgWithAdmin();

        SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => 'API 設計',
            'description' => 'REST API の設計方針',
            'body' => '資料本文',
        ]);

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'API 設計')
            ->assertJsonPath('data.0.description', 'REST API の設計方針')
            ->assertJsonPath('data.0.body', '資料本文');
    }
}
