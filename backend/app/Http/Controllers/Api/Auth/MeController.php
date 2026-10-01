<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Api\ApiController;
use App\Models\Organization\Organization;
use App\Services\Organization\OrganizationContextService;
use App\Support\FieldLengthLimits;
use App\Support\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class MeController extends ApiController
{
    public function __construct(
        private readonly OrganizationContextService $organizationContext,
    ) {}

    /** ログイン中のユーザーを返す。 */
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->userPayload($request->user()));
    }

    /**
     * ログイン後の遷移先組織を解決する（所属 0 件なら organization は null）。
     */
    public function currentOrganization(Request $request): JsonResponse
    {
        $organization = $this->organizationContext->resolveAndRemember($request->user());

        return response()->json([
            'organization' => $organization !== null
                ? $this->organizationPayload($organization)
                : null,
        ]);
    }

    /**
     * 所属組織への切替。last_organization_id を更新する。
     */
    public function switchOrganization(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'organization_id' => ['required_without:slug', 'nullable', 'integer'],
            'slug' => ['required_without:organization_id', 'nullable', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_SLUG],
        ]);

        $organization = null;
        if (! empty($validated['organization_id'])) {
            $organization = Organization::query()->find($validated['organization_id']);
        } elseif (! empty($validated['slug'])) {
            $organization = Organization::query()
                ->where('slug', $validated['slug'])
                ->first();
        }

        if ($organization === null) {
            return response()->json(['message' => '組織が見つかりません。'], 404);
        }

        try {
            $switched = $this->organizationContext->switchTo($request->user(), $organization);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json([
            'organization' => $this->organizationPayload($switched),
        ]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'avatar' => ['required', 'image', 'max:2048'],
        ]);

        $user = $request->user();
        $oldPath = $user->avatar_path;
        $newPath = MediaStorage::storePublic($validated['avatar'], 'avatars');

        $user->avatar_path = $newPath;
        $user->save();

        MediaStorage::deletePublic($oldPath);

        return response()->json([
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ]);
    }

    /** ログイン中ユーザーの表示名だけを更新する。 */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
        ]);

        $user->name = trim($validated['name']);
        $user->save();

        return response()->json([
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        $oldPath = $user->avatar_path;

        $user->avatar_path = null;
        $user->save();

        MediaStorage::deletePublic($oldPath);

        return response()->json([
            'avatar_url' => null,
        ]);
    }
}
