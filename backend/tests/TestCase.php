<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMediaStorage();
    }

    protected function fakeMediaStorage(): void
    {
        Storage::fake($this->publicMediaDisk());
        Storage::fake($this->privateMediaDisk());
    }

    protected function publicMediaDisk(): string
    {
        return (string) config('filesystems.public_media');
    }

    protected function privateMediaDisk(): string
    {
        return (string) config('filesystems.private_media');
    }
}
