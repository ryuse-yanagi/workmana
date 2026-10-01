<?php

namespace App\Support;

use Illuminate\Broadcasting\BroadcastException;

final class SafeBroadcast
{
    /** 自分以外へ配信し、失敗を握りつぶす設定なら記録だけして続行する。 */
    public static function toOthers(object $event): void
    {
        try {
            broadcast($event)->toOthers();
        } catch (BroadcastException $e) {
            if (! config('broadcasting.fail_silently')) {
                throw $e;
            }

            report($e);
        }
    }
}
