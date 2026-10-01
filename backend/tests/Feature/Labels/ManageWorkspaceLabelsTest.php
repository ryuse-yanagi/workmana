<?php

namespace Tests\Feature\Labels;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class ManageWorkspaceLabelsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者だけがワークスペース用ラベルを作成・並び替え・削除できる */
    public function test_admin_can_manage_workspace_label_categories_and_labels(): void
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
            ->patchJson("/api/orgs/acme/workspace-label-categories/{$categoryA}", ['name' => '領域（改）'])
            ->assertOk()
            ->assertJsonPath('name', '領域（改）');

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
            ->assertJsonPath('data.1.id', $categoryA)
            ->assertJsonPath('data.1.name', '領域（改）')
            ->assertJsonPath('data.1.labels.0.id', $labelB);

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspace-labels/{$labelB}")
            ->assertNoContent();

        $this->actingAsApiUser($admin)
            ->deleteJson("/api/orgs/acme/workspace-label-categories/{$categoryB}")
            ->assertNoContent();
    }

    /** 一般メンバーはワークスペース用ラベルを作成できない */
    public function test_member_cannot_create_workspace_label_category(): void
    {
        [, , $member] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($member)
            ->postJson('/api/orgs/acme/workspace-label-categories', ['name' => '領域'])
            ->assertForbidden();
    }
}
