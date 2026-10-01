<?php

namespace App\Http\Controllers\Api\Notification;

use App\Http\Controllers\Api\ApiController;
use App\Models\Notification\AppNotification;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    /** 自分の通知を新しい順にページングする。 */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = AppNotification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at');

        $result = ListQuery::paginate(
            $query,
            $request,
            fn (AppNotification $notification) => $this->notificationPayload($notification),
            defaultPerPage: 30,
        );

        return response()->json($result);
    }

    /** 自分の通知だけ既読にする。他人のものは 404。 */
    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        if ((int) $notification->user_id !== (int) $request->user()->id) {
            abort(404);
        }

        if ($notification->read_at === null) {
            $notification->read_at = now();
            $notification->save();
        }

        return response()->json($this->notificationPayload($notification->fresh()));
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function notificationPayload(AppNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'data' => $notification->data,
            'read_at' => $notification->read_at,
            'created_at' => $notification->created_at,
        ];
    }
}
