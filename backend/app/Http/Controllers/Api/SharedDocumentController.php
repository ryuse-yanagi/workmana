<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentLabel;
use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\Workspace;
use App\Support\BidirectionalRelationSync;
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
        $this->ensureDocumentBelongsToOrganization($document, $organization);

        $document->load([
            'labels',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

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

        $document->load([
            'labels',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json(
            $this->documentPayload($document, $organization),
            201,
        );
    }

    public function update(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);

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

        $document->load([
            'labels',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json($this->documentPayload($document, $organization));
    }

    public function syncRelatedWorkspaces(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);

        $validated = $request->validate([
            'workspace_ids' => ['present', 'array'],
            'workspace_ids.*' => ['integer', 'distinct'],
        ]);

        $workspaceIds = $this->validateRelatedWorkspaceIds(
            $request,
            $organization,
            $validated['workspace_ids'] ?? [],
        );
        $document->relatedWorkspaces()->sync($workspaceIds);
        $document->load([
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
        ]);

        return response()->json([
            'data' => $document->relatedWorkspaces
                ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                ->values(),
        ]);
    }

    public function syncRelatedDocuments(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);

        $validated = $request->validate([
            'document_ids' => ['present', 'array'],
            'document_ids.*' => ['integer', 'distinct'],
        ]);

        $documentIds = $this->validateRelatedDocumentIds(
            $organization,
            $document,
            $validated['document_ids'] ?? [],
        );
        BidirectionalRelationSync::syncRelatedDocuments($document, $documentIds);
        $document->load([
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json([
            'data' => $document->relatedDocuments
                ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                ->values(),
        ]);
    }

    public function detachRelatedWorkspace(
        Request $request,
        Organization $organization,
        SharedDocument $document,
        Workspace $workspace,
    ): JsonResponse {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);

        $document->relatedWorkspaces()->detach($workspace->id);
        $document->load([
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
        ]);

        return response()->json([
            'data' => $document->relatedWorkspaces
                ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                ->values(),
        ]);
    }

    public function detachRelatedDocument(
        Request $request,
        Organization $organization,
        SharedDocument $document,
        SharedDocument $relatedDocument,
    ): JsonResponse {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->ensureDocumentBelongsToOrganization($relatedDocument, $organization);

        BidirectionalRelationSync::detachRelatedDocument($document, $relatedDocument);
        $document->load([
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json([
            'data' => $document->relatedDocuments
                ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                ->values(),
        ]);
    }

    public function destroy(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);

        $document->delete();

        return response()->json(null, 204);
    }

    private function ensureDocumentBelongsToOrganization(SharedDocument $document, Organization $organization): void
    {
        $pivot = request()->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        if ($document->organization_id !== $organization->id) {
            abort(404);
        }
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
     * @param array<int, mixed> $workspaceIds
     * @return array<int, int>
     */
    private function validateRelatedWorkspaceIds(
        Request $request,
        Organization $organization,
        array $workspaceIds,
    ): array {
        $ids = array_values(array_unique(array_map('intval', $workspaceIds)));
        if ($ids === []) {
            return [];
        }

        $count = Workspace::query()
            ->where('organization_id', $organization->id)
            ->whereNull('archived_at')
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more workspaces are invalid for this organization.');
        }

        return $ids;
    }

    /**
     * @param array<int, mixed> $documentIds
     * @return array<int, int>
     */
    private function validateRelatedDocumentIds(
        Organization $organization,
        SharedDocument $document,
        array $documentIds,
    ): array {
        $ids = array_values(array_unique(array_map('intval', $documentIds)));
        $ids = array_values(array_filter($ids, fn (int $id) => $id !== (int) $document->id));
        if ($ids === []) {
            return [];
        }

        $count = SharedDocument::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more documents are invalid for this organization.');
        }

        return $ids;
    }

    /**
     * @return array<string, mixed>
     */
    private function relatedWorkspacePayload(Workspace $workspace): array
    {
        return [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function relatedDocumentPayload(SharedDocument $document): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
            'description' => $document->description,
        ];
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
            'related_workspaces' => $document->relationLoaded('relatedWorkspaces')
                ? $document->relatedWorkspaces
                    ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                    ->values()
                : [],
            'related_documents' => $document->relationLoaded('relatedDocuments')
                ? $document->relatedDocuments
                    ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                    ->values()
                : [],
            'created_at' => $document->created_at,
        ];
    }
}
