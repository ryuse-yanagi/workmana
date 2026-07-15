<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Support\DefaultBoardLists;
use App\Support\DefaultDocumentCategories;
use App\Support\DefaultWorkspaceStatuses;
use App\Enums\TaskEffortUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrganizationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('organizations');

        return response()->json([
            'data' => $user->organizations->map(fn ($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'slug' => $o->slug,
                'role' => $o->pivot->role,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:100',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('organizations', 'slug'),
            ],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $user = $request->user();

        $org = Organization::query()->create([
            'name' => $name,
            'slug' => Str::lower($validated['slug']),
            'effort_unit' => TaskEffortUnit::Hour->value,
            'created_by' => $user->id,
        ]);

        $org->members()->attach($user->id, [
            'role' => 'admin',
            'invited_by' => null,
        ]);

        return response()->json([
            'id' => $org->id,
            'name' => $org->name,
            'slug' => $org->slug,
        ], 201);
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
                'avatar_url' => $this->avatarUrl($user->avatar_path),
            ]),
        ]);
    }

    public function settings(Request $request, Organization $organization): JsonResponse
    {
        return response()->json([
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'default_board_list_names' => DefaultBoardLists::itemsForOrganization($organization),
            'default_workspace_status_names' => DefaultWorkspaceStatuses::itemsForOrganization($organization),
            'default_document_category_names' => DefaultDocumentCategories::itemsForOrganization($organization),
            'effort_unit' => $organization->effort_unit ?? TaskEffortUnit::Hour->value,
        ]);
    }

    public function updateSettings(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can update organization settings.');
        }

        $validated = $request->validate([
            'default_board_list_names' => ['sometimes', 'array', 'max:20'],
            'default_workspace_status_names' => ['sometimes', 'array', 'max:20'],
            'default_document_category_names' => ['sometimes', 'array', 'max:20'],
            'effort_unit' => ['sometimes', 'string', Rule::in(TaskEffortUnit::values())],
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

        if (array_key_exists('effort_unit', $validated)) {
            $organization->effort_unit = $validated['effort_unit'];
        }

        $organization->save();

        return response()->json([
            'id' => $organization->id,
            'slug' => $organization->slug,
            'default_board_list_names' => DefaultBoardLists::itemsForOrganization($organization),
            'default_workspace_status_names' => DefaultWorkspaceStatuses::itemsForOrganization($organization),
            'default_document_category_names' => DefaultDocumentCategories::itemsForOrganization($organization),
            'effort_unit' => $organization->effort_unit ?? TaskEffortUnit::Hour->value,
        ]);
    }
}
