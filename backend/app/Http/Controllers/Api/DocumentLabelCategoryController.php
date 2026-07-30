<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentLabel;
use App\Models\DocumentLabelCategory;
use App\Models\Organization;
use App\Support\FieldLengthLimits;
use App\Support\SortOrderReorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DocumentLabelCategoryController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $categories = DocumentLabelCategory::query()
            ->where('organization_id', $organization->id)
            ->with(['labels' => fn ($query) => $query->orderBy('sort_order')->orderBy('name')])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $categories->map(fn (DocumentLabelCategory $category) => $this->categoryPayload($category)),
        ]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:'.FieldLengthLimits::LABEL_CATEGORY_NAME,
                Rule::unique('document_label_categories', 'name')->where(fn ($q) => $q->where('organization_id', $organization->id)),
            ],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Category name cannot be empty.'], 422);
        }

        $maxOrder = DocumentLabelCategory::query()
            ->where('organization_id', $organization->id)
            ->max('sort_order');

        $category = DocumentLabelCategory::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'sort_order' => $maxOrder === null ? 0 : ((int) $maxOrder + 1),
        ]);

        return response()->json($this->categoryPayload($category->load('labels')), 201);
    }

    public function update(Request $request, Organization $organization, DocumentLabelCategory $category): JsonResponse
    {
        $this->assertOrganizationAdmin($request);
        $this->ensureCategoryBelongsToOrganization($category, $organization);

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:'.FieldLengthLimits::LABEL_CATEGORY_NAME,
                Rule::unique('document_label_categories', 'name')
                    ->where(fn ($q) => $q->where('organization_id', $organization->id))
                    ->ignore($category->id),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Category name cannot be empty.'], 422);
            }
            $category->name = $name;
        }

        if (array_key_exists('sort_order', $validated)) {
            $category->sort_order = (int) $validated['sort_order'];
        }

        $category->save();

        return response()->json($this->categoryPayload($category->load('labels')));
    }

    public function reorder(Request $request, Organization $organization): JsonResponse
    {
        $this->assertOrganizationAdmin($request);
        $validated = $request->validate([
            'category_ids' => ['present', 'array'],
            'category_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var list<int> $categoryIds */
        $categoryIds = array_map('intval', $validated['category_ids']);

        $activeCategoryIds = DocumentLabelCategory::query()
            ->where('organization_id', $organization->id)
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        SortOrderReorder::assertExactIdSet(
            $categoryIds,
            $activeCategoryIds,
            'category_ids',
            'category_ids must include every document label category in the organization exactly once.',
        );

        SortOrderReorder::apply(
            DocumentLabelCategory::query()->where('organization_id', $organization->id),
            $categoryIds,
        );

        return response()->json(['data' => ['ok' => true]]);
    }

    public function destroy(Request $request, Organization $organization, DocumentLabelCategory $category): JsonResponse
    {
        $this->assertOrganizationAdmin($request);
        $this->ensureCategoryBelongsToOrganization($category, $organization);

        $category->delete();

        return response()->json(null, 204);
    }


    private function ensureCategoryBelongsToOrganization(DocumentLabelCategory $category, Organization $organization): void
    {
        if ((int) $category->organization_id !== (int) $organization->id) {
            abort(404);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function categoryPayload(DocumentLabelCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
            'labels' => $category->labels->map(fn (DocumentLabel $label) => [
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
