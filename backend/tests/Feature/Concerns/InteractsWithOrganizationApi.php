<?php

namespace Tests\Feature\Concerns;

use App\Enums\MembershipRole;
use App\Models\Organization\Organization;
use App\Models\User;
use App\Models\Workspace\Workspace;

trait InteractsWithOrganizationApi
{
    /**
     * phpunit.xml の COGNITO_BYPASS=true 専用。Bearer にユーザーIDを載せて認証する。
     * 本番のセッション Cookie 認証は tests/Feature/Auth で別途検証する。
     */
    protected function actingAsApiUser(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->id);
    }

    protected function createOrganizationViaApi(User $user, string $name = 'Acme'): string
    {
        $slug = $this->actingAsApiUser($user)
            ->postJson('/api/organizations', [
                'name' => $name,
            ])
            ->assertCreated()
            ->json('slug');

        $this->assertIsString($slug);

        return $slug;
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

    /**
     * @param  list<int>  $assigneeIds
     */
    protected function syncWorkspaceAssigneesViaApi(
        User $user,
        string $orgSlug,
        int $workspaceId,
        array $assigneeIds,
    ): void {
        $this->actingAsApiUser($user)
            ->patchJson("/api/orgs/{$orgSlug}/workspaces/{$workspaceId}", [
                'assignee_ids' => $assigneeIds,
            ])
            ->assertOk();
    }
}
