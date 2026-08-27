<?php

namespace Tests\Feature\Documents;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ListSharedDocumentsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_organization_member_can_list_shared_documents(): void
    {
        [$user] = $this->createOrgWithAdmin();

        $this->actingAsApiUser($user)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data', []);
    }
}
