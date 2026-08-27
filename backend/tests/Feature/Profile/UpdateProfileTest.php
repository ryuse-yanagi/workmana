<?php

namespace Tests\Feature\Profile;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateProfileTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_profile_can_be_updated(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($admin)
            ->patchJson('/api/me', [
                'name' => 'Admin Updated',
                'email' => 'admin-updated@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Admin Updated')
            ->assertJsonPath('email', 'admin-updated@example.com');

        $this->actingAsApiUser($admin)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('name', 'Admin Updated')
            ->assertJsonPath('email', 'admin-updated@example.com');
    }

    public function test_profile_email_must_be_unique(): void
    {
        [$admin, , $member] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($admin)
            ->patchJson('/api/me', [
                'name' => $admin->name,
                'email' => $member->email,
            ])
            ->assertStatus(422);
    }
}
