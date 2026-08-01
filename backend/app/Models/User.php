<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'cognito_sub', 'avatar_path', 'email_verified_at', 'last_organization_id'])]
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

    public function lastOrganization(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'last_organization_id');
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

    public function isMemberOfOrganization(Organization|int $organization): bool
    {
        $organizationId = $organization instanceof Organization ? $organization->id : $organization;

        return $this->organizations()->where('organizations.id', $organizationId)->exists();
    }

    /**
     * 組織メンバーであればスペースへアクセス・編集できる。
     */
    public function canAccessWorkspace(Workspace $workspace): bool
    {
        return $this->isMemberOfOrganization((int) $workspace->organization_id);
    }

    public function canEditWorkspace(Workspace $workspace): bool
    {
        return $this->canAccessWorkspace($workspace);
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }
}
