<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentLabel;
use App\Models\DocumentLabelCategory;
use App\Models\Organization;
use App\Support\FieldLengthLimits;
use App\Support\LabelColorPresets;
use App\Support\SortOrderReorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentLabelController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $labels = DocumentLabel::query()
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
            abort(403, 'Only organization admins can create document labels.');
        }

        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:document_label_categories,id'],
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::LABEL_NAME],
            'color_index' => ['nullable', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
        ]);

        $category = DocumentLabelCategory::query()->find($validated['category_id']);
        if ($category === null || (int) $category->organization_id !== (int) $organization->id) {
            return response()->json(['message' => 'Invalid category for this organization.'], 422);
        }

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Document label name cannot be empty.'], 422);
        }

        $exists = DocumentLabel::query()
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

        $maxOrder = DocumentLabel::query()
            ->where('category_id', $category->id)
            ->max('sort_order');

        $label = DocumentLabel::query()->create([
            'organization_id' => $organization->id,
            'category_id' => $category->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'color_index' => $colorIndex,
            'sort_order' => $maxOrder === null ? 0 : ((int) $maxOrder + 1),
        ]);

        return response()->json($this->labelPayload($label), 201);
    }

    public function update(Request $request, Organization $organization, DocumentLabel $documentLabel): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can update document labels.');
        }

        if ((int) $documentLabel->organization_id !== (int) $organization->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::LABEL_NAME],
            'color_index' => ['sometimes', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Document label name cannot be empty.'], 422);
            }
            $exists = DocumentLabel::query()
                ->where('category_id', $documentLabel->category_id)
                ->where('name', $name)
                ->where('id', '!=', $documentLabel->id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'A label with this name already exists in the category.'], 422);
            }
            $documentLabel->name = $name;
        }

        if (array_key_exists('color_index', $validated)) {
            $colorIndex = (int) $validated['color_index'];
            if (! LabelColorPresets::isValidIndex($colorIndex)) {
                return response()->json(['message' => 'Invalid label color index.'], 422);
            }
            $documentLabel->color_index = $colorIndex;
        }

        if (array_key_exists('sort_order', $validated)) {
            $documentLabel->sort_order = (int) $validated['sort_order'];
        }

        $documentLabel->save();

        return response()->json($this->labelPayload($documentLabel));
    }

    public function reorder(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can reorder document labels.');
        }

        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:document_label_categories,id'],
            'label_ids' => ['present', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
        ]);

        $category = DocumentLabelCategory::query()->find($validated['category_id']);
        if ($category === null || (int) $category->organization_id !== (int) $organization->id) {
            return response()->json(['message' => 'Invalid category for this organization.'], 422);
        }

        /** @var list<int> $labelIds */
        $labelIds = array_map('intval', $validated['label_ids']);

        $activeLabelIds = DocumentLabel::query()
            ->where('category_id', $category->id)
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        SortOrderReorder::assertExactIdSet(
            $labelIds,
            $activeLabelIds,
            'label_ids',
            'label_ids must include every document label in the category exactly once.',
        );

        SortOrderReorder::apply(
            DocumentLabel::query()->where('category_id', $category->id),
            $labelIds,
        );

        return response()->json(['data' => ['ok' => true]]);
    }

    public function destroy(Request $request, Organization $organization, DocumentLabel $documentLabel): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can delete document labels.');
        }

        if ((int) $documentLabel->organization_id !== (int) $organization->id) {
            abort(404);
        }

        $documentLabel->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function labelPayload(DocumentLabel $label): array
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
