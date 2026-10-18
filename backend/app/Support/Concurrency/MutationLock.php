<?php

namespace App\Support\Concurrency;

use App\Models\Organization\Organization;
use App\Models\Workspace\Workspace;
use Illuminate\Database\Eloquent\Model;

/** トランザクションの中で、同時更新の基準になる行をロックする。 */
final class MutationLock
{
    public static function organization(int $id): Organization
    {
        $organization = Organization::query()->whereKey($id)->lockForUpdate()->first();
        if ($organization === null) {
            abort(404);
        }

        return $organization;
    }

    public static function workspace(int $id): Workspace
    {
        $workspace = Workspace::withTrashed()->whereKey($id)->lockForUpdate()->first();
        if ($workspace === null) {
            abort(404);
        }

        return $workspace;
    }

    /** 削除済みでもアーカイブ済みでもないスペースだけを返す。 */
    public static function activeWorkspace(int $id): Workspace
    {
        $workspace = self::workspace($id);
        if ($workspace->isArchived()) {
            abort(403, 'Workspace is archived.');
        }

        return $workspace;
    }

    /** fillable 以外の変更も、ロックし直した行へ写す。 */
    public static function copyDirty(Model $from, Model $to): void
    {
        foreach ($from->getDirty() as $key => $value) {
            $to->setAttribute($key, $value);
        }
        if ($to->isDirty()) {
            $to->save();
        }
    }
}
