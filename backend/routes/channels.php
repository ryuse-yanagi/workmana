<?php

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('projects.{projectId}', function (User $user, int $projectId) {
    $project = Project::find($projectId);
    if ($project === null) {
        return false;
    }

    return $user->isMemberOfProject($project);
});
