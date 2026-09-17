<?php

namespace App\Http\Controllers\Api;

use App\Services\OrganizationInviteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class InviteAcceptController extends ApiController
{
    public function __construct(
        private readonly OrganizationInviteService $invites,
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

    public function accept(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:8', 'max:255'],
        ]);

        try {
            $result = $this->invites->accept(
                $token,
                $validated['name'],
                $validated['password'],
            );
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
