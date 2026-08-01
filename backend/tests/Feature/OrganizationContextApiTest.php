<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationContextApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    public function test_register_creates_user_without_organization(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => '新規太郎',
            'email' => 'New.User@Example.com',
            'password' => 'password123',
        ])
            ->assertCreated()
            ->assertJsonPath('user.email', 'new.user@example.com')
            ->assertJsonPath('user.name', '新規太郎');

        $user = User::query()->where('email', 'new.user@example.com')->first();
        $this->assertNotNull($user);
        $this->assertNotNull($user->cognito_sub);
        $this->assertSame(0, $user->organizations()->count());
        $this->assertNull($user->last_organization_id);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create([
            'email' => 'dup@example.com',
            'cognito_sub' => 'existing-sub',
        ]);

        $this->postJson('/api/auth/register', [
            'name' => '重複',
            'email' => 'dup@example.com',
            'password' => 'password123',
        ])
            ->assertStatus(422);
    }

    public function test_create_organization_attaches_admin_and_sets_last_organization(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-1']);

        $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => '新しい組織',
            ])
            ->assertCreated()
            ->assertJsonPath('name', '新しい組織')
            ->assertJsonStructure(['id', 'name', 'slug']);

        $user->refresh();
        $this->assertSame(1, $user->organizations()->count());
        $this->assertSame('admin', $user->organizations()->first()->pivot->role);
        $this->assertNotNull($user->last_organization_id);
        $this->assertSame($user->organizations()->first()->id, $user->last_organization_id);
    }

    public function test_current_organization_uses_last_organization_id_when_multiple(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-2']);
        $first = $this->createOrg($user, 'First', 'first');
        $second = $this->createOrg($user, 'Second', 'second');
        $user->last_organization_id = $second->id;
        $user->save();

        $this->actingAsApiUser($user)
            ->getJson('/api/me/current-organization')
            ->assertOk()
            ->assertJsonPath('organization.slug', 'second');

        $user->last_organization_id = null;
        $user->save();

        $this->actingAsApiUser($user)
            ->getJson('/api/me/current-organization')
            ->assertOk()
            ->assertJsonPath('organization.slug', 'first');

        $user->refresh();
        $this->assertSame($first->id, $user->last_organization_id);
    }

    public function test_current_organization_null_when_no_memberships(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-3']);

        $this->actingAsApiUser($user)
            ->getJson('/api/me/current-organization')
            ->assertOk()
            ->assertJsonPath('organization', null);
    }

    public function test_switch_organization_updates_last_organization_id(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-4']);
        $this->createOrg($user, 'Alpha', 'alpha');
        $beta = $this->createOrg($user, 'Beta', 'beta');

        $this->actingAsApiUser($user)
            ->putJson('/api/me/current-organization', ['slug' => 'beta'])
            ->assertOk()
            ->assertJsonPath('organization.slug', 'beta');

        $user->refresh();
        $this->assertSame($beta->id, $user->last_organization_id);
    }

    public function test_switch_organization_rejects_non_member(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-5']);
        $other = User::factory()->create(['cognito_sub' => 'sub-6']);
        $this->createOrg($other, 'Other', 'other');

        $this->actingAsApiUser($user)
            ->putJson('/api/me/current-organization', ['slug' => 'other'])
            ->assertForbidden();
    }

    public function test_session_includes_last_organization_id(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'sub-7']);
        $org = $this->createOrg($user, 'Acme', 'acme');
        $user->last_organization_id = $org->id;
        $user->save();

        $this->actingAsApiUser($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('user.last_organization_id', $org->id);
    }

    private function createOrg(User $user, string $name, string $slug): Organization
    {
        $org = Organization::query()->create([
            'name' => $name,
            'slug' => $slug,
            'created_by' => $user->id,
        ]);
        $org->members()->attach($user->id, ['role' => 'admin']);

        return $org;
    }

    private function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }
}
