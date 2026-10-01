<?php

namespace App\Support\Workspace;

use App\Models\User;
use App\Support\MediaUrl;
use Illuminate\Support\Collection;

final class WorkspaceMembersBroadcast
{
    /**
     * 担当者を名前順に並べ、アバター URL を付けて配信する。
     *
     * @param  Collection<int, User>  $assignees
     * @return list<array{id: int, name: string|null, email: string|null, avatar_url: string|null}>
     */
    public static function membersPayload(Collection $assignees): array
    {
        return $assignees
            ->sortBy([
                fn ($user) => mb_strtolower((string) ($user->name ?: $user->email ?: '')),
                fn ($user) => $user->id,
            ])
            ->values()
            ->map(fn ($user) => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => MediaUrl::avatar($user->avatar_path),
            ])
            ->all();
    }
}
