<?php

namespace App\Http\Controllers\Api;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Services\OrganizationInviteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class OrganizationInviteController extends ApiController
{
    public function __construct(
        private readonly OrganizationInviteService $invites,
    ) {}

    public function index(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $invites = OrganizationInvite::query()
            ->where('organization_id', $organization->id)
            ->whereNull('used_at')
            ->where('expires_at', '>=', now())
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $invites->map(fn (OrganizationInvite $invite) => [
                'id' => $invite->id,
                'email' => $invite->email,
                'role' => $invite->role,
                'expires_at' => $invite->expires_at?->toIso8601String(),
                'created_at' => $invite->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', 'string', Rule::in(MembershipRole::values())],
        ]);

        try {
            $result = $this->invites->createOrResend(
                $organization,
                $validated['email'],
                $validated['role'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $invite = $result['invite'];

        return response()->json([
            'id' => $invite->id,
            'email' => $invite->email,
            'role' => $invite->role,
            'expires_at' => $invite->expires_at?->toIso8601String(),
            'resent' => $result['resent'],
        ], $result['resent'] ? 200 : 201);
    }
}
