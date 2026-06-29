<?php

use App\Models\Workspace;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('workspaces.{workspaceId}', function (User $user, int $workspaceId) {
    $workspace = Workspace::find($workspaceId);
    if ($workspace === null) {
        return false;
    }

    return $user->isMemberOfWorkspace($workspace);
});
