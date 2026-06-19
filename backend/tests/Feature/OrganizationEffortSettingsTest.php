<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationEffortSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_organization_settings_include_effort_unit_default(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonPath('effort_unit', 'hour');
    }

    public function test_organization_admin_can_update_effort_unit(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->postJson('/api/organizations', [
                'name' => 'Acme',
                'slug' => 'acme',
            ])
            ->assertCreated();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->patchJson('/api/orgs/acme/settings', [
                'effort_unit' => 'day',
            ])
            ->assertOk()
            ->assertJsonPath('effort_unit', 'day');

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonPath('effort_unit', 'day');
    }
}
