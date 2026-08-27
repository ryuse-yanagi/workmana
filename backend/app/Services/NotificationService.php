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
     * @param  int|list<int>|null  $exceptUserIds  通知しないユーザー ID（単一または複数）
     */
    public function notifyMany(array $users, string $type, array $data, int|array|null $exceptUserIds = null): void
    {
        $except = [];
        if (is_int($exceptUserIds)) {
            $except[$exceptUserIds] = true;
        } elseif (is_array($exceptUserIds)) {
            foreach ($exceptUserIds as $id) {
                $except[(int) $id] = true;
            }
        }

        $seen = [];
        foreach ($users as $user) {
            $userId = $user instanceof User ? (int) $user->id : (int) $user;
            if ($userId <= 0 || isset($seen[$userId])) {
                continue;
            }
            if (isset($except[$userId])) {
                continue;
            }
            $seen[$userId] = true;
            $this->notify($userId, $type, $data);
        }
    }
}
