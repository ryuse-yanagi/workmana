<?php

namespace Tests\Feature\Concerns;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;

trait InteractsWithOrganizationApi
{
    protected function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }

    /**
     * @return array{0: User, 1: Organization}
     */
    protected function createOrgWithAdmin(
        string $name = 'Acme',
        string $slug = 'acme',
        ?User $admin = null,
    ): array {
        $admin ??= User::factory()->create();
        $organization = Organization::query()->create([
            'name' => $name,
            'slug' => $slug,
            'created_by' => $admin->id,
        ]);
        $organization->members()->attach($admin->id, ['role' => MembershipRole::Admin->value]);

        return [$admin, $organization];
    }

    /**
     * @return array{0: User, 1: Organization, 2: User}
     */
    protected function createOrgWithAdminAndMember(
        string $name = 'Acme',
        string $slug = 'acme',
    ): array {
        [$admin, $organization] = $this->createOrgWithAdmin($name, $slug);
        $member = User::factory()->create(['name' => 'Member']);
        $organization->members()->attach($member->id, ['role' => MembershipRole::Member->value]);

        return [$admin, $organization, $member];
    }

    protected function createOrganizationForUser(
        User $user,
        string $name,
        string $slug,
        string $role = 'admin',
    ): Organization {
        $organization = Organization::query()->create([
            'name' => $name,
            'slug' => $slug,
            'created_by' => $user->id,
        ]);
        $organization->members()->attach($user->id, ['role' => $role]);

        return $organization;
    }

    protected function defaultListId(Workspace $workspace): int
    {
        return (int) $workspace->lists()->orderBy('sort_order')->value('id');
    }

    protected function createWorkspaceViaApi(User $user, string $orgSlug, string $name): int
    {
        return (int) $this->actingAsApiUser($user)
            ->postJson("/api/orgs/{$orgSlug}/workspaces", ['name' => $name])
            ->assertCreated()
            ->json('id');
    }
}
