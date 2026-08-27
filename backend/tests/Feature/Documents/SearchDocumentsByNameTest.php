<?php

namespace Tests\Feature\Documents;

use App\Models\SharedDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class SearchDocumentsByNameTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_documents_can_be_searched_by_name(): void
    {
        [$admin, $organization] = $this->createOrgWithAdminAndMember();

        SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $admin->id,
            'name' => '要件定義書',
        ]);
        SharedDocument::query()->create([
            'organization_id' => $organization->id,
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
