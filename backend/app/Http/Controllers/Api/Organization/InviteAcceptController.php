<?php

namespace App\Http\Controllers\Api\Organization;

use App\Http\Controllers\Api\ApiController;
use App\Services\Auth\CognitoSessionAuthenticator;
use App\Services\Organization\OrganizationInviteService;
use App\Support\MediaUrl;
use App\Support\Organization\OrganizationBroadcast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class InviteAcceptController extends ApiController
{
    public function __construct(
        private readonly OrganizationInviteService $invites,
        private readonly CognitoSessionAuthenticator $authenticator,
    ) {}

    /** 招待の状態を返す。無効は 404、使用済みと期限切れは 410。 */
    public function show(string $token): JsonResponse
    {
        $resolved = $this->invites->resolve($token);
        $status = $resolved['status'];

        if ($status === 'invalid') {
            return response()->json([
                'status' => 'invalid',
                'message' => $resolved['message'] ?? '招待が見つかりません。',
            ], 404);
        }

        $invite = $resolved['invite'];
        $organization = $resolved['organization'];

        $payload = [
            'status' => $status,
            'message' => $resolved['message'] ?? null,
            'email' => $invite->email,
            'role' => $invite->role,
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
            ],
            'expires_at' => $invite->expires_at?->toIso8601String(),
        ];

        if ($status !== 'active') {
            return response()->json($payload, 410);
        }

        return response()->json($payload);
    }

    /** ログイン中で、招待メールと一致するアカウントだけが参加できる。 */
    public function accept(Request $request, string $token): JsonResponse
    {
        $resolved = $this->invites->resolve($token);
        if (($resolved['status'] ?? '') !== 'active') {
            $message = $resolved['message'] ?? '招待を利用できません。';
            $status = str_contains($message, '使用済み') || str_contains($message, '有効期限') || ($resolved['status'] ?? '') !== 'invalid'
                ? 410
                : 404;

            if (($resolved['status'] ?? '') === 'invalid') {
                $status = 404;
            }

            return response()->json([
                'status' => $resolved['status'] ?? 'invalid',
                'message' => $message,
            ], $status === 410 || $status === 404 ? $status : 422);
        }

        $invite = $resolved['invite'];
        $authUser = $this->authenticator->resolve($request);
        if ($authUser === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        try {
            $result = $this->invites->acceptForAuthenticatedUser($token, $authUser);
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            $status = str_contains($message, '使用済み') || str_contains($message, '有効期限')
                ? 410
                : 422;

            return response()->json(['message' => $message], $status);
        }

        $organization = $result['organization'];
        $user = $result['user'];
        OrganizationBroadcast::send($organization, 'member.upserted', [
            'member' => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $invite->role,
                'avatar_url' => MediaUrl::avatar($user->avatar_path),
            ],
        ]);
        OrganizationBroadcast::send($organization, 'invite.removed', [
            'id' => (int) $invite->id,
        ]);

        return response()->json([
            'message' => $result['already_member']
                ? '既にこの組織のメンバーです。'
                : '参加が完了しました。',
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
            ],
        ]);
    }
}
