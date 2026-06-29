<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\TaskLabel;
use App\Models\TaskLabelCategory;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskLabelCategoryController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $categories = TaskLabelCategory::query()
            ->where('organization_id', $organization->id)
            ->with(['labels' => fn ($query) => $query->orderBy('sort_order')->orderBy('name')])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $categories->map(fn (TaskLabelCategory $category) => $this->categoryPayload($category)),
        ]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:'.FieldLengthLimits::LABEL_CATEGORY_NAME,
                Rule::unique('task_label_categories', 'name')->where(fn ($q) => $q->where('organization_id', $organization->id)),
            ],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Category name cannot be empty.'], 422);
        }

        $maxOrder = TaskLabelCategory::query()
            ->where('organization_id', $organization->id)
            ->max('sort_order');

        $category = TaskLabelCategory::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'sort_order' => $maxOrder === null ? 0 : ((int) $maxOrder + 1),
        ]);

        return response()->json($this->categoryPayload($category->load('labels')), 201);
    }

    public function update(Request $request, Organization $organization, TaskLabelCategory $category): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureCategoryBelongsToOrganization($category, $organization);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:'.FieldLengthLimits::LABEL_CATEGORY_NAME,
                Rule::unique('task_label_categories', 'name')
                    ->where(fn ($q) => $q->where('organization_id', $organization->id))
                    ->ignore($category->id),
            ],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Category name cannot be empty.'], 422);
            }
            $category->name = $name;
        }

        $category->save();

        return response()->json($this->categoryPayload($category->load('labels')));
    }

    public function destroy(Request $request, Organization $organization, TaskLabelCategory $category): JsonResponse
    {
        $this->ensureAdmin($request);
        $this->ensureCategoryBelongsToOrganization($category, $organization);

        $category->delete();

        return response()->json(null, 204);
    }

    private function ensureAdmin(Request $request): void
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can manage task label categories.');
        }
    }

    private function ensureCategoryBelongsToOrganization(TaskLabelCategory $category, Organization $organization): void
    {
        if ((int) $category->organization_id !== (int) $organization->id) {
            abort(404);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function categoryPayload(TaskLabelCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
            'labels' => $category->labels->map(fn (TaskLabel $label) => [
                'id' => $label->id,
                'category_id' => $label->category_id,
                'name' => $label->name,
                'color_index' => $label->color_index,
                'sort_order' => $label->sort_order,
                'created_at' => $label->created_at,
            ])->values()->all(),
        ];
    }
}
