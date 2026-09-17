<?php

namespace App\Models;

use App\Support\OrganizationAccess;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'cognito_sub', 'avatar_path', 'email_verified_at'])]
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
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function membershipFor(Organization $organization): ?object
    {
        return $this->organizations()->where('organizations.id', $organization->id)->first()?->pivot;
    }

    public function workspacePivot(Workspace $workspace): ?object
    {
        return $this->workspaces()->where('workspaces.id', $workspace->id)->first()?->pivot;
    }

    public function isMemberOfWorkspace(Workspace $workspace): bool
    {
        return $this->workspaces()->where('workspaces.id', $workspace->id)->exists();
    }

    public function isMemberOfOrganization(Organization|int $organization): bool
    {
        $organizationId = $organization instanceof Organization ? $organization->id : $organization;

        return $this->organizations()->where('organizations.id', $organizationId)->exists();
    }

    public function canAccessWorkspace(Workspace $workspace): bool
    {
        $organization = $workspace->organization;
        if ($organization === null) {
            return false;
        }

        return OrganizationAccess::canViewWorkspace(
            $this,
            $workspace,
            $this->membershipFor($organization),
        );
    }

    /**
     * 閲覧できるスペースは編集可。workspace_memberships.role が viewer のときのみ閲覧専用。
     */
    public function canEditWorkspace(Workspace $workspace): bool
    {
        if (! $this->canAccessWorkspace($workspace)) {
            return false;
        }

        $pivot = $this->workspacePivot($workspace);
        if ($pivot !== null && ($pivot->role ?? '') === 'viewer') {
            return false;
        }

        return true;
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_memberships')
            ->withPivot(['role', 'added_by'])
            ->withTimestamps();
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }
}
