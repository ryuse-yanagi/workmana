<?php

namespace Tests\Unit\Filesystem;

use App\Filesystem\S3AclFreeDisk;
use Aws\Command;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Support\Facades\Storage;
use ReflectionProperty;
use Tests\TestCase;

class S3AclFreeDiskTest extends TestCase
{
    /** S3 ドライバは ACL を付けない実装に差し替わっている */
    public function test_s3_driver_strips_acl_headers(): void
    {
        $manager = Storage::getFacadeRoot();
        $this->assertInstanceOf(FilesystemManager::class, $manager);

        $creators = new ReflectionProperty($manager, 'customCreators');
        $this->assertArrayHasKey('s3', $creators->getValue($manager));
    }

    /** PutObject に付いた ACL は送信前に除く */
    public function test_without_acl_removes_the_header(): void
    {
        $command = new Command('PutObject', [
            'Bucket' => 'work-manager-test',
            'Key' => 'avatars/a.jpg',
            'Body' => 'x',
            'ACL' => 'public-read',
        ]);

        $stripped = S3AclFreeDisk::withoutAcl($command);

        $this->assertFalse($stripped->offsetExists('ACL'));
        $this->assertSame('avatars/a.jpg', $stripped->offsetGet('Key'));
    }
}
