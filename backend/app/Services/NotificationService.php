<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;

class NotificationService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function notify(User|int $user, string $type, array $data): AppNotification
    {
        $userId = $user instanceof User ? (int) $user->id : $user;

        return AppNotification::query()->create([
            'user_id' => $userId,
            'type' => $type,
            'data' => $data,
        ]);
    }

    /**
     * @param  array<int, int|User>  $users
     * @param  array<string, mixed>  $data
     */
    public function notifyMany(array $users, string $type, array $data, ?int $exceptUserId = null): void
    {
        $seen = [];
        foreach ($users as $user) {
            $userId = $user instanceof User ? (int) $user->id : (int) $user;
            if ($userId <= 0 || isset($seen[$userId])) {
                continue;
            }
            if ($exceptUserId !== null && $userId === $exceptUserId) {
                continue;
            }
            $seen[$userId] = true;
            $this->notify($userId, $type, $data);
        }
    }
}
