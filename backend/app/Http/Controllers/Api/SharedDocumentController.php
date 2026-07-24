<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentLabel;
use App\Models\Organization;
use App\Models\SharedDocument;
use App\Support\DefaultDocumentCategories;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SharedDocumentController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $documents = SharedDocument::query()
            ->where('organization_id', $organization->id)
            ->with(['labels'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $documents->map(fn (SharedDocument $document) => $this->documentPayload($document, $organization)),
        ]);
    }

    public function show(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        if ($document->organization_id !== $organization->id) {
            abort(404);
        }

        $document->load(['labels']);

        return response()->json($this->documentPayload($document, $organization));
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string'],
            'category' => ['nullable', 'string', 'max:255'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $category = DefaultDocumentCategories::validateCategoryForOrganization(
            $organization,
            $validated['category'] ?? null,
        );

        $document = SharedDocument::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
            'name' => $name,
            'description' => $validated['description'] ?? null,
            'category' => $category,
        ]);

        $labelIds = $this->validateDocumentLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );
        if ($labelIds !== []) {
            $document->labels()->sync($labelIds);
        }

        $document->load(['labels']);

        return response()->json(
            $this->documentPayload($document, $organization),
            201,
        );
    }

    public function update(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        if ($document->organization_id !== $organization->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string'],
            'body' => ['nullable', 'string', 'max:'.FieldLengthLimits::DOCUMENT_BODY],
            'category' => ['sometimes', 'nullable', 'string', 'max:255'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Name cannot be empty.'], 422);
            }
            $document->name = $name;
        }
        if (array_key_exists('description', $validated)) {
            $document->description = $validated['description'];
        }
        if (array_key_exists('body', $validated)) {
            $document->body = $validated['body'];
        }
        if (array_key_exists('category', $validated)) {
            $document->category = DefaultDocumentCategories::validateCategoryForOrganization(
                $organization,
                $validated['category'],
            );
        }
        $document->save();

        if (array_key_exists('label_ids', $validated)) {
            $labelIds = $this->validateDocumentLabelIds($organization, $validated['label_ids'] ?? []);
            $document->labels()->sync($labelIds);
        }

        $document->load(['labels']);

        return response()->json($this->documentPayload($document, $organization));
    }

    public function destroy(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        if ($document->organization_id !== $organization->id) {
            abort(404);
        }

        $document->delete();

        return response()->json(null, 204);
    }

    /**
     * @param array<int, mixed> $labelIds
     * @return array<int, int>
     */
    private function validateDocumentLabelIds(Organization $organization, array $labelIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $labelIds)));
        if ($ids === []) {
            return [];
        }

        $count = DocumentLabel::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more labels are invalid for this organization.');
        }

        return $ids;
    }

    /**
     * @return array<string, mixed>
     */
    private function documentPayload(SharedDocument $document, Organization $organization): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
            'description' => $document->description,
            'body' => $document->body,
            'category' => DefaultDocumentCategories::resolvedCategoryPayload($document, $organization),
            'labels' => $document->labels->map(fn (DocumentLabel $label) => [
                'id' => $label->id,
                'category_id' => $label->category_id,
                'name' => $label->name,
                'color_index' => $label->color_index,
            ])->values()->all(),
            'created_at' => $document->created_at,
        ];
    }
}
