<?php

namespace App\Support\Workspace;

use App\Models\User;
use App\Models\Workspace\Workspace;
use App\Support\MediaUrl;

final class WorkspaceBroadcastPayload
{
    /**
     * ピンと資料は閲覧者ごと、または別イベントで届けるため含めない。
     *
     * @return array<string, mixed>
     */
    public static function make(Workspace $workspace): array
    {
        $workspace->loadMissing([
            'organization',
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
        ]);

        $organization = $workspace->organization;

        return [
            'id' => (int) $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
            'status' => $organization !== null
                ? DefaultWorkspaceStatuses::resolvedStatusPayload($workspace, $organization)
                : null,
            'archived_at' => $workspace->archived_at,
            'created_at' => $workspace->created_at,
            'updated_at' => $workspace->updated_at,
            'labels' => $workspace->labels->map(fn ($label) => [
                'id' => (int) $label->id,
                'name' => $label->name,
                'color_index' => $label->color_index,
            ])->values()->all(),
            'assignees' => $workspace->assignees
                ->sortBy([
                    fn (User $user) => mb_strtolower((string) ($user->name ?: $user->email ?: '')),
                    fn (User $user) => $user->id,
                ])
                ->values()
                ->map(fn (User $user) => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => MediaUrl::avatar($user->avatar_path),
                ])->all(),
        ];
    }
}
