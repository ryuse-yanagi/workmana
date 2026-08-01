<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\User;
use RuntimeException;

/**
 * ログイン後の利用組織決定と組織切替。
 * アクセス可否は必ず memberships 経由で判定する。
 */
class OrganizationContextService
{
    /**
     * 所属組織から現在利用すべき組織を決定し、last_organization_id を更新する。
     * 所属が無い場合は null。
     */
    public function resolveAndRemember(User $user): ?Organization
    {
        $organizations = $user->organizations()
            ->orderBy('organizations.id')
            ->get();

        if ($organizations->isEmpty()) {
            if ($user->last_organization_id !== null) {
                $user->last_organization_id = null;
                $user->save();
            }

            return null;
        }

        if ($organizations->count() === 1) {
            $organization = $organizations->first();
            $this->remember($user, $organization);

            return $organization;
        }

        if ($user->last_organization_id !== null) {
            $last = $organizations->firstWhere('id', (int) $user->last_organization_id);
            if ($last !== null) {
                $this->remember($user, $last);

                return $last;
            }
        }

        $first = $organizations->first();
        $this->remember($user, $first);

        return $first;
    }

    /**
     * 所属を確認したうえで現在利用中組織を更新する。
     *
     * @throws RuntimeException 未所属の場合
     */
    public function switchTo(User $user, Organization $organization): Organization
    {
        if (! $user->isMemberOfOrganization($organization)) {
            throw new RuntimeException('所属していない組織には切り替えできません。');
        }

        $this->remember($user, $organization);

        return $organization;
    }

    public function remember(User $user, Organization $organization): void
    {
        if ((int) $user->last_organization_id === (int) $organization->id) {
            return;
        }

        $user->last_organization_id = $organization->id;
        $user->save();
    }
}
