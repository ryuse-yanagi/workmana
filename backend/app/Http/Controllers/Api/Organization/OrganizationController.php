<?php

namespace App\Http\Controllers\Api\Organization;

use App\Http\Controllers\Api\ApiController;
use App\Models\Organization\Organization;
use App\Models\User;
use App\Services\Notification\NotificationService;
use App\Services\Organization\OrganizationContextService;
use App\Services\Organization\OrganizationMemberService;
use App\Support\Document\DefaultDocumentCategories;
use App\Support\FieldLengthLimits;
use App\Support\MediaStorage;
use App\Support\Organization\OrganizationSlug;
use App\Support\Workspace\DefaultBoardLists;
use App\Support\Workspace\DefaultWorkspaceStatuses;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;

class OrganizationController extends ApiController
{
    public function __construct(
        private readonly OrganizationMemberService $members,
        private readonly OrganizationContextService $organizationContext,
        private readonly NotificationService $notifications,
    ) {}

    /** 組織を作り、作成者を管理者にして現在の組織に覚える。 */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_NAME],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => FieldLengthLimits::requiredLengthMessage('組織名', FieldLengthLimits::ORGANIZATION_NAME)], 422);
        }

        $user = $request->user();

        try {
            $org = retry(
                OrganizationSlug::ATTEMPTS,
                function () use ($name, $user) {
                    return DB::transaction(function () use ($name, $user) {
                        $org = Organization::query()->create([
                            'name' => $name,
                            'slug' => OrganizationSlug::generate(),
                            'created_by' => $user->id,
                        ]);

                        $org->members()->attach($user->id, [
                            'role' => 'admin',
                        ]);

                        $this->organizationContext->remember($user, $org);

                        return $org;
                    });
                },
                0,
                fn (\Throwable $e) => $e instanceof UniqueConstraintViolationException,
            );
        } catch (UniqueConstraintViolationException) {
            return response()->json([
                'message' => '組織の作成に失敗しました。もう一度お試しください。',
            ], 503);
        }

        return response()->json($this->organizationPayload($org), 201);
    }

    public function members(Request $request, Organization $organization): JsonResponse
    {
        $members = $organization->members()
            ->orderBy('users.name')
            ->get(['users.id', 'users.name', 'users.email', 'users.avatar_path']);

        return response()->json([
            'data' => $members->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->pivot->role,
                'avatar_url' => $this->avatarUrl($user->avatar_path),
            ]),
        ]);
    }

    /** 組織管理者のみ。ロールが変わったとき本人に通知する。 */
    public function updateMember(Request $request, Organization $organization, User $member): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(['admin', 'member'])],
        ]);

        $previous = $organization->members()->where('users.id', $member->id)->first();
        $previousRole = (string) ($previous?->pivot?->role ?? '');

        try {
            $this->members->updateRole(
                $organization,
                $member,
                $validated['role'],
                $request->user(),
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($previousRole !== '' && $previousRole !== $validated['role']) {
            $this->notifications->notifyMany(
                [(int) $member->id],
                'organization.role_changed',
                [
                    'organization_slug' => $organization->slug,
                    'organization_name' => $organization->name,
                    'role' => $validated['role'],
                    'title' => $organization->name,
                ],
                $request->user()?->id,
            );
        }

        $member->load(['organizations' => fn ($q) => $q->where('organizations.id', $organization->id)]);

        return response()->json([
            'id' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'role' => $validated['role'],
            'avatar_url' => $this->avatarUrl($member->avatar_path),
        ]);
    }

    /** 組織管理者のみメンバーを外す。 */
    public function removeMember(Request $request, Organization $organization, User $member): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        try {
            $this->members->remove($organization, $member, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
    }

    public function settings(Request $request, Organization $organization): JsonResponse
    {
        return response()->json($this->settingsPayload($request, $organization));
    }

    /** 組織管理者のみアイコンを差し替える。 */
    public function uploadIcon(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $validated = $request->validate([
            'icon' => ['required', 'image', 'max:2048'],
        ]);

        $oldPath = $organization->icon_path;
        $newPath = MediaStorage::storePublic($validated['icon'], 'org-icons');

        $organization->icon_path = $newPath;
        $organization->save();

        MediaStorage::deletePublic($oldPath);

        return response()->json([
            'icon_url' => $this->iconUrl($organization->icon_path),
        ]);
    }

    /** 組織管理者のみアイコンを消す。 */
    public function deleteIcon(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $oldPath = $organization->icon_path;
        $organization->icon_path = null;
        $organization->save();

        MediaStorage::deletePublic($oldPath);

        return response()->json([
            'icon_url' => null,
        ]);
    }

    /** 組織管理者のみ。既定のステータス名と資料カテゴリ名の変更は既存データへ反映する。 */
    public function updateSettings(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_NAME],
            'default_board_list_names' => ['sometimes', 'array', 'min:1'],
            'default_board_list_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::LIST_NAME],
            'default_workspace_status_names' => ['sometimes', 'array'],
            'default_workspace_status_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::WORKSPACE_STATUS_NAME],
            'default_document_category_names' => ['sometimes', 'array'],
            'default_document_category_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::DOCUMENT_CATEGORY_NAME],
        ]);

        if ($request->has('name')) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json([
                    'message' => FieldLengthLimits::requiredLengthMessage('組織名', FieldLengthLimits::ORGANIZATION_NAME),
                ], 422);
            }
            $organization->name = $name;
        }

        DB::transaction(function () use ($request, $organization) {
            if ($request->has('default_board_list_names')) {
                $organization->default_board_list_names = DefaultBoardLists::normalizeItems(
                    $request->input('default_board_list_names'),
                );
            }

            if ($request->has('default_workspace_status_names')) {
                $oldStatusItems = DefaultWorkspaceStatuses::itemsForOrganization($organization);
                $newStatusItems = DefaultWorkspaceStatuses::normalizeItems(
                    $request->input('default_workspace_status_names'),
                );
                DefaultWorkspaceStatuses::syncWorkspaceStatusNames(
                    $organization,
                    $oldStatusItems,
                    $newStatusItems,
                );
                $organization->default_workspace_status_names = $newStatusItems;
            }

            if ($request->has('default_document_category_names')) {
                $oldCategoryItems = DefaultDocumentCategories::itemsForOrganization($organization);
                $newCategoryItems = DefaultDocumentCategories::normalizeItems(
                    $request->input('default_document_category_names'),
                );
                DefaultDocumentCategories::syncDocumentCategoryNames(
                    $organization,
                    $oldCategoryItems,
                    $newCategoryItems,
                );
                $organization->default_document_category_names = $newCategoryItems;
            }

            $organization->save();
        });

        return response()->json($this->settingsPayload($request, $organization));
    }

    /**
     * role を欠くと設定画面が更新結果をキャッシュし、管理者の編集操作が消える。
     *
     * @return array<string, mixed>
     */
    private function settingsPayload(Request $request, Organization $organization): array
    {
        $pivot = $request->attributes->get('organization_membership');

        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'icon_url' => $this->iconUrl($organization->icon_path),
            'role' => $pivot->role ?? null,
            'created_at' => $organization->created_at?->toIso8601String(),
            'default_board_list_names' => DefaultBoardLists::itemsForOrganization($organization),
            'default_workspace_status_names' => DefaultWorkspaceStatuses::itemsForOrganization($organization),
            'default_document_category_names' => DefaultDocumentCategories::itemsForOrganization($organization),
        ];
    }
}
