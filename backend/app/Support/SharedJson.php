<?php

namespace App\Support;

final class SharedJson
{
    /** @var array<string, array<string, mixed>> */
    private static array $cache = [];

    /**
     * リポジトリ直下の shared JSON を読み、プロセス内では再読込しない。
     *
     * @return array<string, mixed>
     */
    public static function load(string $filename): array
    {
        if (isset(self::$cache[$filename])) {
            return self::$cache[$filename];
        }

        $path = dirname(base_path()).DIRECTORY_SEPARATOR.'shared'.DIRECTORY_SEPARATOR.$filename;
        if (! is_file($path)) {
            throw new \RuntimeException("Shared JSON not found: {$path}");
        }

        $decoded = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($decoded)) {
            throw new \RuntimeException("Shared JSON invalid: {$path}");
        }

        return self::$cache[$filename] = $decoded;
    }
}
