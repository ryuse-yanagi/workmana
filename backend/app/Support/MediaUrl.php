<?php

namespace App\Support;

/**
 * 公開メディアは、ローカルなら /storage 相対パス、S3 なら絶対 URL を返す。
 */
final class MediaUrl
{
    public static function publicPath(?string $path): ?string
    {
        return MediaStorage::publicUrl($path);
    }

    public static function avatar(?string $avatarPath): ?string
    {
        return self::publicPath($avatarPath);
    }
}
