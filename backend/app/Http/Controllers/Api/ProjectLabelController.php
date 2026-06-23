<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\ProjectLabel;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectLabelController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $labels = ProjectLabel::query()
            ->where('organization_id', $organization->id)
            ->orderBy('name')
            ->get(['id', 'name', 'color', 'created_at']);

        return response()->json(['data' => $labels]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can create project labels.');
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:'.FieldLengthLimits::LABEL_NAME,
                Rule::unique('project_labels', 'name')->where(fn ($q) => $q->where('organization_id', $organization->id)),
            ],
            'color' => ['nullable', 'string', 'max:20', 'regex:/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Project label name cannot be empty.'], 422);
        }

        $label = ProjectLabel::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'color' => $validated['color'] ?? '#64748b',
        ]);

        return response()->json([
            'id' => $label->id,
            'name' => $label->name,
            'color' => $label->color,
            'created_at' => $label->created_at,
        ], 201);
    }
}
