<?php

namespace App\Filesystem;

use Aws\CommandInterface;
use Aws\Middleware;
use Aws\S3\S3Client;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Filesystem\FilesystemManager;

/**
 * ACL 無効の S3 では PutObject の ACL を外し、公開読み取りは avatars/* と org-icons/* のバケットポリシーまたは CloudFront で行う。
 */
final class S3AclFreeDisk
{
    public static function register(FilesystemManager $manager): void
    {
        $manager->extend('s3', function ($app, array $config) {
            /** @var AwsS3V3Adapter $disk */
            $disk = $this->createS3Driver($config);

            \App\Filesystem\S3AclFreeDisk::stripAcl($disk->getClient());

            return $disk;
        });
    }

    public static function withoutAcl(CommandInterface $command): CommandInterface
    {
        if ($command->offsetExists('ACL')) {
            $command->offsetUnset('ACL');
        }

        return $command;
    }

    public static function stripAcl(S3Client $client): void
    {
        $client->getHandlerList()->prependBuild(
            Middleware::mapCommand(fn (CommandInterface $command) => self::withoutAcl($command)),
            'strip-s3-acl'
        );
    }
}
