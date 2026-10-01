<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * アバターと組織アイコンは公開ディスク、タスク添付は非公開ディスクへ置く。
 */
final class MediaStorage
{
    public static function publicDiskName(): string
    {
        return (string) config('filesystems.public_media', 'public');
    }

    public static function privateDiskName(): string
    {
        return (string) config('filesystems.private_media', 'local');
    }

    public static function publicDisk(): Filesystem
    {
        return Storage::disk(self::publicDiskName());
    }

    public static function privateDisk(): Filesystem
    {
        return Storage::disk(self::privateDiskName());
    }

    public static function storePublic(UploadedFile $file, string $directory): string
    {
        $path = $file->store($directory, [
            'disk' => self::publicDiskName(),
            'visibility' => 'public',
        ]);

        if (! is_string($path) || $path === '') {
            throw new RuntimeException('Failed to store public media.');
        }

        return $path;
    }

    public static function storePrivate(UploadedFile $file, string $directory): string
    {
        $path = $file->store($directory, [
            'disk' => self::privateDiskName(),
            'visibility' => 'private',
        ]);

        if (! is_string($path) || $path === '') {
            throw new RuntimeException('Failed to store private media.');
        }

        return $path;
    }

    /** 現在の公開ディスクと public ディスクの両方から消す。 */
    public static function deletePublic(?string $path): void
    {
        if (! $path) {
            return;
        }

        self::deleteFromDisks($path, [self::publicDiskName(), 'public']);
    }

    /** 現在の非公開ディスクに加え、local と public に残っていれば消す。 */
    public static function deletePrivate(?string $path): void
    {
        if (! $path) {
            return;
        }

        self::deleteFromDisks($path, [self::privateDiskName(), 'local', 'public']);
    }

    /** 非公開ディレクトリを、現在の非公開ディスクと local と public から消す。 */
    public static function deletePrivateDirectory(string $directory): void
    {
        foreach (array_unique([self::privateDiskName(), 'local', 'public']) as $diskName) {
            $disk = Storage::disk($diskName);
            if ($disk->exists($directory)) {
                $disk->deleteDirectory($directory);
            }
        }
    }

    /** 現在の非公開ディスク、local、public の順で、ファイルがあるディスクを返す。 */
    public static function resolvePrivateDisk(string $path): ?Filesystem
    {
        foreach (array_unique([self::privateDiskName(), 'local', 'public']) as $diskName) {
            $disk = Storage::disk($diskName);
            if ($disk->exists($path)) {
                return $disk;
            }
        }

        return null;
    }

    /** S3 なら絶対 URL、ローカルなら /storage 相対パスを返す。 */
    public static function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (self::usesObjectStorage(self::publicDiskName())) {
            return self::publicDisk()->url($path);
        }

        return '/storage/'.ltrim($path, '/');
    }

    public static function usesObjectStorage(?string $diskName = null): bool
    {
        $diskName ??= self::publicDiskName();

        return config("filesystems.disks.{$diskName}.driver") === 's3';
    }

    /**
     * @param  list<string>  $diskNames
     */
    private static function deleteFromDisks(string $path, array $diskNames): void
    {
        foreach (array_unique($diskNames) as $diskName) {
            $disk = Storage::disk($diskName);
            if ($disk->exists($path)) {
                $disk->delete($path);
            }
        }
    }
}
