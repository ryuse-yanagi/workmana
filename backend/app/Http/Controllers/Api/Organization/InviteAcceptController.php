<?php

namespace App\Http\Controllers\Api\Organization;

use App\Http\Controllers\Api\ApiController;
use App\Models\User;
use App\Services\Auth\CognitoSessionAuthenticator;
use App\Services\Organization\OrganizationInviteService;
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

    /** 連携済みメールはログイン必須。未連携は名前とパスワードで参加する。 */
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
        $existing = User::query()
            ->whereRaw('LOWER(email) = ?', [mb_strtolower((string) $invite->email)])
            ->first();
        $authUser = $this->authenticator->resolve($request);

        try {
            if ($existing !== null && $existing->cognito_sub !== null && $existing->cognito_sub !== '') {
                if ($authUser === null || strcasecmp((string) $authUser->email, (string) $invite->email) !== 0) {
                    return response()->json(['message' => 'Unauthenticated.'], 401);
                }

                $result = $this->invites->acceptForAuthenticatedUser($token, $authUser);
            } else {
                $validated = $request->validate([
                    'name' => ['required', 'string', 'max:20'],
                    'password' => ['required', 'string', 'min:8', 'max:255'],
                ]);

                $result = $this->invites->accept(
                    $token,
                    $validated['name'],
                    $validated['password'],
                );
            }
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            $status = str_contains($message, '使用済み') || str_contains($message, '有効期限')
                ? 410
                : 422;

            return response()->json(['message' => $message], $status);
        }

        $organization = $result['organization'];

        return response()->json([
            'message' => $result['already_member']
                ? '既に組織に参加済みです。ログインしてください。'
                : '参加が完了しました。ログインしてください。',
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
            ],
        ]);
    }
}
