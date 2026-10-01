<?php

namespace App\Models;

use App\Models\Notification\AppNotification;
use App\Models\Organization\Organization;
use App\Models\Workspace\Workspace;
use App\Support\Organization\OrganizationAccess;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'cognito_sub', 'avatar_path', 'email_verified_at', 'last_organization_id'])]
#[Hidden(['remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
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
     * 組織メンバーとして開けるスペースは編集可。
     */
    public function canEditWorkspace(Workspace $workspace): bool
    {
        return $this->canAccessWorkspace($workspace);
    }

    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }
}
