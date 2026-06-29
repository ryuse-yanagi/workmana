<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SharedDocumentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_member_can_list_shared_documents(): void
    {
        $user = User::factory()->create();
        $organization = Organization::query()->create([
            'name' => 'Acme',
            'slug' => 'acme',
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => 'admin']);

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/documents')
            ->assertOk()
            ->assertJsonPath('data', []);
    }
}
