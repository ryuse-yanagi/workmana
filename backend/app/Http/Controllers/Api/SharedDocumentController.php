<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentLabel;
use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use App\Models\Workspace;
use App\Support\BidirectionalRelationSync;
use App\Support\DefaultDocumentCategories;
use App\Support\FieldLengthLimits;
use App\Support\ListQuery;
use App\Support\PermanentDeleter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SharedDocumentController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $query = SharedDocument::query()
            ->where('organization_id', $organization->id)
            ->notArchived()
            ->with(['labels'])
            ->orderByDesc('created_at');

        $viewer = $request->user();
        $result = ListQuery::paginate(
            $query,
            $request,
            fn (SharedDocument $document) => $this->documentPayload($document, $organization, $viewer),
            ['shared_documents.name', 'shared_documents.description'],
        );

        return response()->json($result);
    }

    public function archivedIndex(Request $request, Organization $organization): JsonResponse
    {
        if (! $request->attributes->get('organization_membership')) {
            abort(403);
        }

        $documents = SharedDocument::query()
            ->where('organization_id', $organization->id)
            ->archived()
            ->with(['labels'])
            ->orderByDesc('archived_at')
            ->get();

        $viewer = $request->user();

        return response()->json([
            'data' => $documents->map(fn (SharedDocument $document) => $this->documentPayload($document, $organization, $viewer)),
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

        return response()->json($this->documentPayload($document, $organization, $request->user()));
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'category' => ['nullable', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
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

        $labelIds = $this->validateDocumentLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );

        $document = DB::transaction(function () use (
            $organization,
            $request,
            $name,
            $validated,
            $category,
            $labelIds,
        ) {
            $document = SharedDocument::query()->create([
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
                'name' => $name,
                'description' => $validated['description'] ?? null,
                'category' => $category,
            ]);

            if ($labelIds !== []) {
                $document->labels()->sync($labelIds);
            }

            return $document;
        });

        $document->load([
            'labels',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json(
            $this->documentPayload($document, $organization, $request->user()),
            201,
        );
    }

    public function update(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertDocumentNotArchived($document);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'body' => ['nullable', 'string', 'max:'.FieldLengthLimits::DOCUMENT_BODY],
            'category' => ['sometimes', 'nullable', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
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

        $labelIds = array_key_exists('label_ids', $validated)
            ? $this->validateDocumentLabelIds($organization, $validated['label_ids'] ?? [])
            : null;

        DB::transaction(function () use ($document, $labelIds) {
            $document->save();

            if ($labelIds !== null) {
                $document->labels()->sync($labelIds);
            }
        });

        $document->load([
            'labels',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json($this->documentPayload($document, $organization, $request->user()));
    }

    public function syncRelatedWorkspaces(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertDocumentNotArchived($document);

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

        $viewer = $request->user();

        return response()->json([
            'data' => $this->filterAccessibleWorkspaces($viewer, $document->relatedWorkspaces)
                ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                ->values(),
        ]);
    }

    public function syncRelatedDocuments(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertDocumentNotArchived($document);

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
        $this->assertDocumentNotArchived($document);
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);

        $document->relatedWorkspaces()->detach($workspace->id);
        $document->load([
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
        ]);

        $viewer = $request->user();

        return response()->json([
            'data' => $this->filterAccessibleWorkspaces($viewer, $document->relatedWorkspaces)
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
        $this->assertDocumentNotArchived($document);
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

    public function archive(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);

        if ($document->isArchived()) {
            return response()->json(['message' => 'Document is already archived.'], 422);
        }

        $document->archived_at = now();
        $document->save();

        return response()->json($this->documentPayload($document, $organization, $request->user()));
    }

    public function unarchive(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertCanRestoreOrPermanentlyDelete($request);

        if (! $document->isArchived()) {
            return response()->json(['message' => 'Document is not archived.'], 422);
        }

        $document->archived_at = null;
        $document->save();

        return response()->json($this->documentPayload($document, $organization, $request->user()));
    }

    public function destroy(Request $request, Organization $organization, SharedDocument $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertCanRestoreOrPermanentlyDelete($request);

        if (! $document->isArchived()) {
            return response()->json([
                'message' => 'Archive the document before deleting it permanently.',
            ], 422);
        }

        PermanentDeleter::deleteDocument($document);

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

    private function assertDocumentNotArchived(SharedDocument $document): void
    {
        if ($document->isArchived()) {
            abort(403, 'Cannot update an archived document.');
        }
    }

    /**
     * @param  array<int, mixed>  $labelIds
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
     * @param  array<int, mixed>  $workspaceIds
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

        $workspaces = Workspace::query()
            ->where('organization_id', $organization->id)
            ->whereNull('archived_at')
            ->whereIn('id', $ids)
            ->get(['id', 'organization_id', 'archived_at']);
        if ($workspaces->count() !== count($ids)) {
            abort(422, 'One or more workspaces are invalid for this organization.');
        }

        $user = $request->user();
        foreach ($workspaces as $workspace) {
            if (! $user->canAccessWorkspace($workspace)) {
                abort(422, 'One or more workspaces are invalid for this organization.');
            }
        }

        return $ids;
    }

    /**
     * @param  array<int, mixed>  $documentIds
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
            ->notArchived()
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
    private function documentPayload(SharedDocument $document, Organization $organization, User $viewer): array
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
                ? $this->filterAccessibleWorkspaces($viewer, $document->relatedWorkspaces)
                    ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                    ->values()
                : [],
            'related_documents' => $document->relationLoaded('relatedDocuments')
                ? $document->relatedDocuments
                    ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                    ->values()
                : [],
            'archived_at' => $document->archived_at,
            'created_at' => $document->created_at,
            'updated_at' => $document->updated_at,
        ];
    }
}
