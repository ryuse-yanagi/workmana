<?php

namespace App\Http\Controllers\Api\Organization;

use App\Enums\MembershipRole;
use App\Http\Controllers\Api\ApiController;
use App\Models\Organization\Organization;
use App\Models\Organization\OrganizationInvite;
use App\Services\Organization\OrganizationInviteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class OrganizationInviteController extends ApiController
{
    public function __construct(
        private readonly OrganizationInviteService $invites,
    ) {}

    /** 未使用かつ期限内の招待だけを返す。組織管理者のみ。 */
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

    /** 組織管理者のみ。有効な招待があれば再送する。 */
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
                $request->user()?->id,
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

    /** 組織管理者のみ招待を取り消す。 */
    public function destroy(Request $request, Organization $organization, OrganizationInvite $invite): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        if ((int) $invite->organization_id !== (int) $organization->id) {
            abort(404);
        }

        $invite->delete();

        return response()->json(null, 204);
    }
}
