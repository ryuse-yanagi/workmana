<?php

namespace Tests\Feature\Profile;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Concerns\InteractsWithOrganizationApi;
use Tests\TestCase;

class UpdateProfileTest extends TestCase
{
    use InteractsWithOrganizationApi;
    use RefreshDatabase;

    /** プロフィール名を更新できる */
    public function test_profile_name_can_be_updated(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();
        $originalEmail = $admin->email;

        $this->actingAsApiUser($admin)
            ->patchJson('/api/me', [
                'name' => 'Admin Updated',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Admin Updated')
            ->assertJsonPath('email', $originalEmail);

        $this->actingAsApiUser($admin)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('name', 'Admin Updated')
            ->assertJsonPath('email', $originalEmail);
    }

    /** メールアドレスは送信しても更新されない */
    public function test_profile_email_is_not_updated_even_if_sent(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();
        $originalEmail = $admin->email;

        $this->actingAsApiUser($admin)
            ->patchJson('/api/me', [
                'name' => 'Admin Updated',
                'email' => 'admin-updated@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Admin Updated')
            ->assertJsonPath('email', $originalEmail);

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'email' => $originalEmail,
        ]);
    }

    /** プロフィールのアバターをアップロードし、削除できる */
    public function test_profile_avatar_can_be_uploaded_and_deleted(): void
    {
        [$admin] = $this->createOrgWithAdminAndMember();

        $upload = $this->actingAsApiUser($admin)
            ->post('/api/me/avatar', [
                'avatar' => UploadedFile::fake()->image('avatar.jpg'),
            ])
            ->assertOk();

        $admin->refresh();
        $this->assertNotNull($admin->avatar_path);
        Storage::disk($this->publicMediaDisk())->assertExists($admin->avatar_path);
        $this->assertSame(
            Storage::disk($this->publicMediaDisk())->url($admin->avatar_path),
            $upload->json('avatar_url'),
        );

        $this->actingAsApiUser($admin)
            ->deleteJson('/api/me/avatar')
            ->assertOk()
            ->assertJsonPath('avatar_url', null);

        Storage::disk($this->publicMediaDisk())->assertMissing($admin->avatar_path);
        $this->assertNull($admin->fresh()->avatar_path);
    }
}
