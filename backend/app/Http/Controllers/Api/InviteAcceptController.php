<?php

namespace App\Http\Controllers\Api;

use App\Services\CognitoSessionAuthenticator;
use App\Services\OrganizationContextService;
use App\Services\OrganizationInviteService;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use RuntimeException;

class InviteAcceptController extends ApiController
{
    public function __construct(
        private readonly OrganizationInviteService $invites,
        private readonly CognitoSessionAuthenticator $authenticator,
        private readonly OrganizationContextService $organizationContext,
    ) {}

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
        $accountContext = $this->invites->accountContext($invite);

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
            'account_exists' => $accountContext['account_exists'],
            'requires_authentication' => $accountContext['requires_authentication'],
        ];

        if ($status !== 'active') {
            return response()->json($payload, 410);
        }

        return response()->json($payload);
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        $resolved = $this->invites->resolve($token);
        if (($resolved['status'] ?? '') !== 'active') {
            $message = $resolved['message'] ?? '招待を利用できません。';
            $status = in_array($resolved['status'] ?? '', ['used', 'expired'], true) ? 410 : 422;

            return response()->json(['message' => $message], $status);
        }

        /** @var \App\Models\OrganizationInvite $invite */
        $invite = $resolved['invite'];
        $accountContext = $this->invites->accountContext($invite);

        try {
            if ($accountContext['requires_authentication']) {
                $user = $this->authenticator->resolve($request);
                if ($user === null) {
                    return response()->json(['message' => 'ログインが必要です。'], 401);
                }

                Auth::setUser($user);
                $result = $this->invites->acceptAuthenticated($token, $user);
            } else {
                $validated = $request->validate([
                    'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
                    'password' => ['required', 'string', 'min:8', 'max:'.FieldLengthLimits::PASSWORD],
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
        $this->organizationContext->remember($result['user'], $organization);

        $authenticated = $accountContext['requires_authentication']
            && $this->authenticator->resolve($request) !== null;

        $message = $result['already_member']
            ? ($authenticated
                ? '既に組織に参加済みです。'
                : '既に組織に参加済みです。ログインしてください。')
            : ($authenticated
                ? '参加が完了しました。'
                : '参加が完了しました。ログインしてください。');

        return response()->json([
            'message' => $message,
            'authenticated' => $authenticated,
            'organization' => $this->organizationPayload($organization),
        ]);
    }
}
