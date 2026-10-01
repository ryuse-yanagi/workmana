<?php

namespace Tests\Unit\Support;

use App\Support\MediaStorage;
use App\Support\MediaUrl;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaStorageTest extends TestCase
{
    /** FILESYSTEM_DISK=s3 のとき公開メディアは s3-public に保存される */
    public function test_public_media_is_stored_on_s3_public_disk(): void
    {
        $this->assertSame('s3-public', MediaStorage::publicDiskName());

        $path = MediaStorage::storePublic(UploadedFile::fake()->image('avatar.jpg'), 'avatars');

        Storage::disk('s3-public')->assertExists($path);
        $this->assertSame(
            Storage::disk('s3-public')->url($path),
            MediaUrl::avatar($path),
        );
        $this->assertStringContainsString('avatars/', (string) MediaUrl::avatar($path));
    }

    /** FILESYSTEM_DISK=s3 のとき添付は s3-private に保存され、公開 URL は出さない */
    public function test_private_media_is_stored_on_s3_private_disk(): void
    {
        $this->assertSame('s3-private', MediaStorage::privateDiskName());

        $path = MediaStorage::storePrivate(
            UploadedFile::fake()->create('notes.txt', 12, 'text/plain'),
            'tasks/1',
        );

        Storage::disk('s3-private')->assertExists($path);
        MediaStorage::deletePrivate($path);
        Storage::disk('s3-private')->assertMissing($path);
    }

    /** ローカル public ディスクのときは相対 /storage パスを返す */
    public function test_local_public_disk_returns_relative_storage_url(): void
    {
        config(['filesystems.public_media' => 'public']);
        Storage::fake('public');

        $this->assertSame('/storage/avatars/me.jpg', MediaUrl::avatar('avatars/me.jpg'));
    }
}
