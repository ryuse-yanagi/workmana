<?php

namespace App\Services\Organization;

use App\Models\Organization\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/** 利用組織は所属だけで決め、last_organization_id を更新する。 */
class OrganizationContextService
{
    /**
     * 所属から現在の組織を決め、所属が無ければ null にして last_organization_id を消す。
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

    /** カラムが無い、または同じ組織なら保存しない。 */
    public function remember(User $user, Organization $organization): void
    {
        if (! Schema::hasColumn('users', 'last_organization_id')) {
            return;
        }

        if ((int) $user->last_organization_id === (int) $organization->id) {
            return;
        }

        $user->last_organization_id = $organization->id;
        $user->save();
    }
}
