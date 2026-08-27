<?php

namespace App\Support;

/**
 * 公開ディスク上のメディア URL を組み立てる。
 *
 * APP_URL に依存する絶対 URL は、フロント（例: :3000）と API（例: :8000）が
 * 分離しているローカル構成で壊れるため、常に相対パス `/storage/...` を返す。
 * フロント側で API オリジン／Vite プロキシに解決する。
 */
final class MediaUrl
{
    public static function publicPath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        return '/storage/'.ltrim($path, '/');
    }

    public static function avatar(?string $avatarPath): ?string
    {
        return self::publicPath($avatarPath);
    }
}
