<?php

namespace App\Support;

use Illuminate\Broadcasting\BroadcastException;

final class SafeBroadcast
{
    /**
     * @param  object  $event
     */
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
