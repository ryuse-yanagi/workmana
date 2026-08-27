<?php

namespace Tests\Feature\Labels;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ManageWorkspaceLabelsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    public function test_workspace_label_categories_and_labels_can_be_managed(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();

        $categoryA = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspace-label-categories', ['name' => '領域'])
            ->assertCreated()
            ->json('id');

        $categoryB = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspace-label-categories', ['name' => '優先度'])
            ->assertCreated()
            ->json('id');

        $labelA = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspace-labels', [
                'category_id' => $categoryA,
                'name' => 'Frontend',
                'color_index' => 0,
            ])
            ->assertCreated()
            ->json('id');

        $labelB = (int) $this->actingAsApiUser($admin)
            ->postJson('/api/orgs/acme/workspace-labels', [
                'category_id' => $categoryA,
                'name' => 'Backend',
                'color_index' => 1,
            ])
            ->assertCreated()
            ->json('id');

        $this->actingAsApiUser($admin)
            ->patchJson('/api/orgs/acme/workspace-label-categories/reorder', [
                'category_ids' => [$categoryB, $categoryA],
            ])
            ->assertOk();

        $this->actingAsApiUser($admin)
            ->patchJson('/api/orgs/acme/workspace-labels/reorder', [
                'category_id' => $categoryA,
                'label_ids' => [$labelB, $labelA],
            ])
            ->assertOk();

        $this->actingAsApiUser($admin)
            ->patchJson("/api/orgs/acme/workspace-labels/{$labelA}", ['name' => 'UI'])
            ->assertOk()
            ->assertJsonPath('name', 'UI');

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/workspace-label-categories')
            ->assertOk()
            ->assertJsonPath('data.0.id', $categoryB)
            ->assertJsonPath('data.1.labels.0.id', $labelB);

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspace-labels/{$labelB}")
            ->assertNoContent();

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspace-label-categories/{$categoryB}")
            ->assertNoContent();
    }
}
