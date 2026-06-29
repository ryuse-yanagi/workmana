<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\TaskLabel;
use App\Models\TaskLabelCategory;
use App\Support\FieldLengthLimits;
use App\Support\LabelColorPresets;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'category_id', 'name', 'color_index', 'sort_order', 'created_at']);

        return response()->json(['data' => $labels]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can create task labels.');
        }

        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:task_label_categories,id'],
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::LABEL_NAME],
            'color_index' => ['nullable', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
        ]);

        $category = TaskLabelCategory::query()->find($validated['category_id']);
        if ($category === null || (int) $category->organization_id !== (int) $organization->id) {
            return response()->json(['message' => 'Invalid category for this organization.'], 422);
        }

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Task label name cannot be empty.'], 422);
        }

        $exists = TaskLabel::query()
            ->where('category_id', $category->id)
            ->where('name', $name)
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'A label with this name already exists in the category.'], 422);
        }

        $colorIndex = (int) ($validated['color_index'] ?? LabelColorPresets::DEFAULT_INDEX);
        if (! LabelColorPresets::isValidIndex($colorIndex)) {
            return response()->json(['message' => 'Invalid label color index.'], 422);
        }

        $maxOrder = TaskLabel::query()
            ->where('category_id', $category->id)
            ->max('sort_order');

        $label = TaskLabel::query()->create([
            'organization_id' => $organization->id,
            'category_id' => $category->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'color_index' => $colorIndex,
            'sort_order' => $maxOrder === null ? 0 : ((int) $maxOrder + 1),
        ]);

        return response()->json($this->labelPayload($label), 201);
    }

    public function update(Request $request, Organization $organization, TaskLabel $taskLabel): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can update task labels.');
        }

        if ((int) $taskLabel->organization_id !== (int) $organization->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::LABEL_NAME],
            'color_index' => ['sometimes', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Task label name cannot be empty.'], 422);
            }
            $exists = TaskLabel::query()
                ->where('category_id', $taskLabel->category_id)
                ->where('name', $name)
                ->where('id', '!=', $taskLabel->id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'A label with this name already exists in the category.'], 422);
            }
            $taskLabel->name = $name;
        }

        if (array_key_exists('color_index', $validated)) {
            $colorIndex = (int) $validated['color_index'];
            if (! LabelColorPresets::isValidIndex($colorIndex)) {
                return response()->json(['message' => 'Invalid label color index.'], 422);
            }
            $taskLabel->color_index = $colorIndex;
        }

        $taskLabel->save();

        return response()->json($this->labelPayload($taskLabel));
    }

    public function destroy(Request $request, Organization $organization, TaskLabel $taskLabel): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can delete task labels.');
        }

        if ((int) $taskLabel->organization_id !== (int) $organization->id) {
            abort(404);
        }

        $taskLabel->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function labelPayload(TaskLabel $label): array
    {
        return [
            'id' => $label->id,
            'category_id' => $label->category_id,
            'name' => $label->name,
            'color_index' => $label->color_index,
            'sort_order' => $label->sort_order,
            'created_at' => $label->created_at,
        ];
    }
}
