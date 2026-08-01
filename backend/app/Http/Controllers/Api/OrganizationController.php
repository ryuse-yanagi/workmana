<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\User;
use App\Services\OrganizationContextService;
use App\Services\OrganizationMemberService;
use App\Support\DefaultBoardLists;
use App\Support\DefaultDocumentCategories;
use App\Support\DefaultWorkspaceStatuses;
use App\Support\FieldLengthLimits;
use App\Support\OrganizationSlug;
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
    ) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_NAME],
            'slug' => [
                'sometimes',
                'nullable',
                'string',
                'max:'.FieldLengthLimits::ORGANIZATION_SLUG,
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('organizations', 'slug'),
            ],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => '組織名を入力してください。'], 422);
        }

        $user = $request->user();
        $slug = OrganizationSlug::uniqueFromName($name, $validated['slug'] ?? null);

        $org = DB::transaction(function () use ($name, $slug, $user) {
            $org = Organization::query()->create([
                'name' => $name,
                'slug' => $slug,
                'created_by' => $user->id,
            ]);

            $org->members()->attach($user->id, [
                'role' => 'admin',
                'invited_by' => null,
            ]);

            $this->organizationContext->remember($user, $org);

            return $org;
        });

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

    public function updateMember(Request $request, Organization $organization, User $member): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(['admin', 'member'])],
        ]);

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

        $member->load(['organizations' => fn ($q) => $q->where('organizations.id', $organization->id)]);

        return response()->json([
            'id' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'role' => $validated['role'],
            'avatar_url' => $this->avatarUrl($member->avatar_path),
        ]);
    }

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
        $pivot = $request->attributes->get('organization_membership');

        return response()->json([
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'role' => $pivot->role ?? null,
            'default_board_list_names' => DefaultBoardLists::itemsForOrganization($organization),
            'default_workspace_status_names' => DefaultWorkspaceStatuses::itemsForOrganization($organization),
            'default_document_category_names' => DefaultDocumentCategories::itemsForOrganization($organization),
        ]);
    }

    public function updateSettings(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);

        $validated = $request->validate([
            'default_board_list_names' => ['sometimes', 'array', 'max:20'],
            'default_board_list_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
            'default_workspace_status_names' => ['sometimes', 'array', 'max:20'],
            'default_workspace_status_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
            'default_document_category_names' => ['sometimes', 'array', 'max:20'],
            'default_document_category_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
        ]);

        if ($request->has('default_board_list_names')) {
            $organization->default_board_list_names = DefaultBoardLists::normalizeItems(
                $request->input('default_board_list_names'),
            );
        }

        if ($request->has('default_workspace_status_names')) {
            $organization->default_workspace_status_names = DefaultWorkspaceStatuses::normalizeItems(
                $request->input('default_workspace_status_names'),
            );
        }

        if ($request->has('default_document_category_names')) {
            $organization->default_document_category_names = DefaultDocumentCategories::normalizeItems(
                $request->input('default_document_category_names'),
            );
        }

        $organization->save();

        return response()->json([
            'id' => $organization->id,
            'slug' => $organization->slug,
            'default_board_list_names' => DefaultBoardLists::itemsForOrganization($organization),
            'default_workspace_status_names' => DefaultWorkspaceStatuses::itemsForOrganization($organization),
            'default_document_category_names' => DefaultDocumentCategories::itemsForOrganization($organization),
        ]);
    }
}
