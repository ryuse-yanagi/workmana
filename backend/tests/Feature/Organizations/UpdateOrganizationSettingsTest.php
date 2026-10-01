<?php

namespace Tests\Feature\Organizations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateOrganizationSettingsTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** 管理者は組織のデフォルトステータス設定を更新できる */
    public function test_organization_settings_can_be_updated(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($admin)
            ->getJson('/api/orgs/acme/settings')
            ->assertOk()
            ->assertJsonStructure([
                'default_board_list_names',
                'default_workspace_status_names',
                'default_document_category_names',
            ]);

        $this->actingAsApiUser($admin)
            ->patchJson('/api/orgs/acme/settings', [
                'default_workspace_status_names' => [
                    ['name' => '準備中', 'color_index' => 1],
                    ['name' => '稼働中', 'color_index' => 0],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('role', 'admin')
            ->assertJsonPath('default_workspace_status_names.0.name', '準備中')
            ->assertJsonPath('default_workspace_status_names.1.name', '稼働中');
    }

    /** 組織アイコンをアップロードし、削除できる */
    public function test_organization_icon_can_be_uploaded_and_deleted(): void
    {
        [$admin, $organization] = $this->createOrgWithAdminAndMember();

        $upload = $this->actingAsApiUser($admin)
            ->post('/api/orgs/acme/icon', [
                'icon' => UploadedFile::fake()->image('icon.png'),
            ])
            ->assertOk();

        $organization->refresh();
        $this->assertNotNull($organization->icon_path);
        Storage::disk($this->publicMediaDisk())->assertExists($organization->icon_path);
        $this->assertSame(
            Storage::disk($this->publicMediaDisk())->url($organization->icon_path),
            $upload->json('icon_url'),
        );

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/orgs/acme/icon')
            ->assertOk()
            ->assertJsonPath('icon_url', null);

        Storage::disk($this->publicMediaDisk())->assertMissing($organization->icon_path);
        $this->assertNull($organization->fresh()->icon_path);
    }

    /** 一般メンバーは組織設定とアイコンを変更できない */
    public function test_member_cannot_update_organization_settings_or_icon(): void
    {
        [, , $member] = $this->createOrgWithAdminAndMember();

        $this->actingAsApiUser($member)
            ->patchJson('/api/orgs/acme/settings', [
                'name' => 'Hacked',
            ])
            ->assertForbidden();
    }
}
