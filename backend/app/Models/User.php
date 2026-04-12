<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'cognito_sub'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'memberships')
            ->withPivot(['role', 'invited_by'])
            ->withTimestamps();
    }

    public function membershipFor(Organization $organization): ?object
    {
        return $this->organizations()->where('organizations.id', $organization->id)->first()?->pivot;
    }

    public function projectPivot(Project $project): ?object
    {
        return $this->projects()->where('projects.id', $project->id)->first()?->pivot;
    }

    public function isMemberOfProject(Project $project): bool
    {
        return $this->projects()->where('projects.id', $project->id)->exists();
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_memberships')
            ->withPivot(['role', 'added_by'])
            ->withTimestamps();
    }
}
