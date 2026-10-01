<?php

use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('workspaces.{workspaceId}', function (User $user, int $workspaceId) {
    $workspace = Workspace::find($workspaceId);
    if ($workspace === null) {
        return false;
    }

    return $user->canAccessWorkspace($workspace);
});
