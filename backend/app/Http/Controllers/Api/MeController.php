<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Models\User;
use App\Services\OrganizationContextService;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;

class MeController extends ApiController
{
    public function __construct(
        private readonly OrganizationContextService $organizationContext,
    ) {}

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
        $newPath = $validated['avatar']->store('avatars', 'public');

        $user->avatar_path = $newPath;
        $user->save();

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $email = OrganizationInvite::normalizeEmail((string) $request->input('email', ''));
        $request->merge(['email' => $email]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
            'email' => [
                'required',
                'string',
                'email',
                'max:'.FieldLengthLimits::EMAIL,
                Rule::unique(User::class, 'email')->ignore($user->id),
            ],
        ]);

        $user->name = trim($validated['name']);
        $user->email = $validated['email'];
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

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'avatar_url' => null,
        ]);
    }
}
