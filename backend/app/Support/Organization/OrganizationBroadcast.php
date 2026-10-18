<?php

namespace App\Support\Organization;

use App\Events\Organization\OrganizationChanged;
use App\Models\Organization\Organization;
use App\Models\User;
use App\Support\MediaUrl;
use App\Support\SafeBroadcast;

final class OrganizationBroadcast
{
    /**
     * @param  array<string, mixed>  $data
     */
    public static function send(Organization|int $organization, string $type, array $data = []): void
    {
        $organizationId = $organization instanceof Organization
            ? (int) $organization->id
            : $organization;

        SafeBroadcast::toOthers(new OrganizationChanged($organizationId, $type, $data));
    }

    /** ユーザー名とアバターを、所属する各組織へ配信する。 */
    public static function userProfile(User $user): void
    {
        $user->loadMissing('organizations:organizations.id');
        $data = [
            'user' => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'avatar_url' => MediaUrl::avatar($user->avatar_path),
            ],
        ];

        foreach ($user->organizations as $organization) {
            self::send($organization, 'user.profile_updated', $data);
        }
    }
}
