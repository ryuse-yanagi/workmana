<?php

namespace Tests\Feature\Documents;

use App\Models\SharedDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class DocumentIndexReturnsAllItemsWithoutPaginationCapTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_document_index_returns_all_items_without_pagination_cap(): void
    {
        [$admin, $organization] = $this->createOrgWithAdminAndMember();

        for ($i = 1; $i <= 55; $i++) {
            SharedDocument::query()->create([
                'organization_id' => $organization->id,
                'created_by' => $admin->id,
                'name' => sprintf('Doc %02d', $i),
            ]);
        }

        $documents = $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/documents?per_page=50')
            ->assertOk()
            ->json();

        $this->assertSame(55, $documents['meta']['total']);
        $this->assertCount(55, $documents['data']);
        $this->assertSame(1, $documents['meta']['last_page']);
    }
}
