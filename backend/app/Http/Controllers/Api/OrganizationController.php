<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Support\DefaultBoardLists;
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
                'work_unit_label' => $o->work_unit_label ?? 'プロジェクト',
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
            'work_unit_label' => 'プロジェクト',
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
            'work_unit_label' => $org->work_unit_label,
        ], 201);
    }

    public function settings(Request $request, Organization $organization): JsonResponse
    {
        return response()->json([
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'work_unit_label' => $organization->work_unit_label ?? 'プロジェクト',
            'default_board_list_names' => DefaultBoardLists::namesForOrganization($organization),
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
            'work_unit_label' => ['sometimes', 'string', 'max:40'],
            'default_board_list_names' => ['sometimes', 'array', 'max:20'],
            'default_board_list_names.*' => ['string', 'max:255'],
            'effort_unit' => ['sometimes', 'string', Rule::in(TaskEffortUnit::values())],
        ]);

        if (array_key_exists('work_unit_label', $validated)) {
            $label = trim($validated['work_unit_label']);
            if ($label === '') {
                return response()->json(['message' => 'Work unit label cannot be empty.'], 422);
            }
            $organization->work_unit_label = $label;
        }

        if (array_key_exists('default_board_list_names', $validated)) {
            $organization->default_board_list_names = DefaultBoardLists::normalizeNames($validated['default_board_list_names']);
        }

        if (array_key_exists('effort_unit', $validated)) {
            $organization->effort_unit = $validated['effort_unit'];
        }

        $organization->save();

        return response()->json([
            'id' => $organization->id,
            'slug' => $organization->slug,
            'work_unit_label' => $organization->work_unit_label,
            'default_board_list_names' => DefaultBoardLists::namesForOrganization($organization),
            'effort_unit' => $organization->effort_unit ?? TaskEffortUnit::Hour->value,
        ]);
    }
}
