<?php

namespace App\Services\Organization;

use App\Enums\MembershipRole;
use App\Mail\OrganizationInviteMail;
use App\Models\Organization\Organization;
use App\Models\Organization\OrganizationInvite;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class OrganizationInviteService
{
    public function __construct(
        private readonly OrganizationContextService $organizationContext,
    ) {}

    /**
     * 有効な未使用招待があれば再送し、無ければ新規作成する。既存メンバーは拒否する。
     *
     * @return array{invite: OrganizationInvite, resent: bool}
     */
    public function createOrResend(Organization $organization, string $email, string $role): array
    {
        $email = OrganizationInvite::normalizeEmail($email);
        $role = MembershipRole::from($role)->value;

        $existingMember = $organization->members()
            ->whereRaw('LOWER(users.email) = ?', [$email])
            ->exists();
        if ($existingMember) {
            throw new RuntimeException('このメールアドレスは既に組織のメンバーです。');
        }

        $active = OrganizationInvite::query()
            ->where('organization_id', $organization->id)
            ->where('email', $email)
            ->whereNull('used_at')
            ->where('expires_at', '>=', now())
            ->first();

        if ($active !== null) {
            $active->role = $role;
            $plainToken = $this->reissueToken($active);
            $this->sendInviteMail($active, $organization, $plainToken);

            return ['invite' => $active->fresh(), 'resent' => true];
        }

        // 期限切れの未使用招待があれば置き換える
        OrganizationInvite::query()
            ->where('organization_id', $organization->id)
            ->where('email', $email)
            ->whereNull('used_at')
            ->delete();

        $plainToken = $this->generatePlainToken();
        $invite = OrganizationInvite::query()->create([
            'organization_id' => $organization->id,
            'email' => $email,
            'role' => $role,
            'token' => OrganizationInvite::hashToken($plainToken),
            'expires_at' => now()->addDays((int) config('invites.expires_days', 7)),
        ]);

        $this->sendInviteMail($invite, $organization, $plainToken);

        return ['invite' => $invite, 'resent' => false];
    }

    /**
     * トークンから招待の状態（invalid、used、expired、active）を返す。
     *
     * @return array{status: string, invite?: OrganizationInvite, organization?: Organization, message?: string}
     */
    public function resolve(string $plainToken): array
    {
        $invite = OrganizationInvite::findByPlainToken($plainToken);
        if ($invite === null) {
            return [
                'status' => 'invalid',
                'message' => '招待が見つかりません。',
            ];
        }

        $invite->load('organization');

        if ($invite->isUsed()) {
            return [
                'status' => 'used',
                'message' => 'この招待は使用済みです',
                'invite' => $invite,
                'organization' => $invite->organization,
            ];
        }

        if ($invite->isExpired()) {
            return [
                'status' => 'expired',
                'message' => 'この招待の有効期限が切れています。',
                'invite' => $invite,
                'organization' => $invite->organization,
            ];
        }

        return [
            'status' => 'active',
            'invite' => $invite,
            'organization' => $invite->organization,
        ];
    }

    /**
     * ログイン済みユーザー向け。招待メールとログイン中メールが一致する必要がある。
     *
     * @return array{user: User, organization: Organization, already_member: bool}
     */
    public function acceptForAuthenticatedUser(string $plainToken, User $authUser): array
    {
        $resolved = $this->resolve($plainToken);
        if (($resolved['status'] ?? '') !== 'active') {
            throw new RuntimeException($resolved['message'] ?? '招待を利用できません。');
        }

        /** @var OrganizationInvite $invite */
        $invite = $resolved['invite'];
        /** @var Organization $organization */
        $organization = $resolved['organization'];

        if (strcasecmp((string) $authUser->email, (string) $invite->email) !== 0) {
            throw new RuntimeException('この招待は別のメールアドレス宛です。');
        }

        return DB::transaction(function () use ($invite, $organization, $authUser) {
            $invite = OrganizationInvite::query()
                ->whereKey($invite->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($invite->isUsed()) {
                throw new RuntimeException('この招待は使用済みです');
            }
            if ($invite->isExpired()) {
                throw new RuntimeException('この招待の有効期限が切れています。');
            }

            $alreadyMember = $organization->members()
                ->where('users.id', $authUser->id)
                ->exists();

            if (! $alreadyMember) {
                $organization->members()->attach($authUser->id, [
                    'role' => $invite->role,
                ]);
            }

            $invite->used_at = now();
            $invite->save();

            if (! $alreadyMember) {
                $this->organizationContext->remember($authUser, $organization);
            }

            return [
                'user' => $authUser->fresh(),
                'organization' => $organization,
                'already_member' => $alreadyMember,
            ];
        });
    }

    /** 平文トークンを再発行し、有効期限を延ばす。 */
    private function reissueToken(OrganizationInvite $invite): string
    {
        $plainToken = $this->generatePlainToken();
        $invite->token = OrganizationInvite::hashToken($plainToken);
        $invite->expires_at = now()->addDays((int) config('invites.expires_days', 7));
        $invite->save();

        return $plainToken;
    }

    private function generatePlainToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private function sendInviteMail(OrganizationInvite $invite, Organization $organization, string $plainToken): void
    {
        $frontendUrl = rtrim((string) config('cognito.frontend_url'), '/');
        $inviteUrl = $frontendUrl.'/invite/'.$plainToken;

        Mail::to($invite->email)->send(new OrganizationInviteMail(
            $invite,
            $organization,
            $plainToken,
            $inviteUrl,
        ));
    }
}
