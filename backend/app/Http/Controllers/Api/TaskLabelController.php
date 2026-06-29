<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\TaskLabel;
use App\Support\FieldLengthLimits;
use App\Support\LabelColorPresets;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskLabelController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $labels = TaskLabel::query()
            ->where('organization_id', $organization->id)
            ->orderBy('name')
            ->get(['id', 'name', 'color_index', 'created_at']);

        return response()->json(['data' => $labels]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can create task labels.');
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:'.FieldLengthLimits::LABEL_NAME,
                Rule::unique('task_labels', 'name')->where(fn ($q) => $q->where('organization_id', $organization->id)),
            ],
            'color_index' => ['nullable', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Task label name cannot be empty.'], 422);
        }

        $colorIndex = (int) ($validated['color_index'] ?? LabelColorPresets::DEFAULT_INDEX);
        if (! LabelColorPresets::isValidIndex($colorIndex)) {
            return response()->json(['message' => 'Invalid label color index.'], 422);
        }

        $label = TaskLabel::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'color_index' => $colorIndex,
        ]);

        return response()->json([
            'id' => $label->id,
            'name' => $label->name,
            'color_index' => $label->color_index,
            'created_at' => $label->created_at,
        ], 201);
    }
}
