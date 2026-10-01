<?php

namespace App\Http\Controllers\Api\Document;

use App\Http\Controllers\Api\ApiController;
use App\Models\Document\Document;
use App\Models\Organization\Organization;
use App\Models\Workspace\Workspace;
use App\Support\Document\DefaultDocumentCategories;
use App\Support\FieldLengthLimits;
use App\Support\ListQuery;
use App\Support\PermanentDeleter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentController extends ApiController
{
    /** 組織の未アーカイブ資料を一覧する。 */
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $query = Document::query()
            ->where('organization_id', $organization->id)
            ->notArchived()
            ->orderByDesc('created_at');

        $result = ListQuery::all(
            $query,
            $request,
            fn (Document $document) => $this->documentPayload($document, $organization),
            ['shared_documents.name', 'shared_documents.description'],
        );

        return response()->json($result);
    }

    public function archivedIndex(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $query = Document::query()
            ->where('organization_id', $organization->id)
            ->archived()
            ->orderByDesc('archived_at');

        $documents = $query->get();

        return response()->json([
            'data' => $documents->map(fn (Document $document) => $this->documentPayload($document, $organization)),
        ]);
    }

    public function show(Request $request, Organization $organization, Document $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);

        return response()->json($this->documentPayload($document, $organization));
    }

    /** 編集できる未アーカイブのスペースに資料を作る。 */
    public function store(Request $request, Organization $organization): JsonResponse
    {
        $workspaceId = $request->validate([
            'workspace_id' => ['required', 'integer'],
        ])['workspace_id'];
        $workspace = Workspace::query()->find($workspaceId);
        if ($workspace === null) {
            abort(422, 'Invalid workspace for this organization.');
        }
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        return $this->createDocument($request, $organization, $workspace);
    }

    public function workspaceIndex(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $documents = $workspace->documents()
            ->notArchived()
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'data' => $documents
                ->map(fn (Document $document) => $this->documentPayload($document, $organization))
                ->values(),
        ]);
    }

    public function workspaceArchivedIndex(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $documents = $workspace->documents()
            ->archived()
            ->orderByDesc('archived_at')
            ->get();

        return response()->json([
            'data' => $documents
                ->map(fn (Document $document) => $this->documentPayload($document, $organization))
                ->values(),
        ]);
    }

    /** アーカイブ済みスペース、または編集権限が無い場合は資料を作れない。 */
    public function storeForWorkspace(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        return $this->createDocument($request, $organization, $workspace);
    }

    private function createDocument(
        Request $request,
        Organization $organization,
        Workspace $workspace,
    ): JsonResponse {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'category' => ['nullable', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $category = DefaultDocumentCategories::validateCategoryForOrganization(
            $organization,
            $validated['category'] ?? null,
        );

        $document = DB::transaction(function () use (
            $organization,
            $request,
            $name,
            $validated,
            $category,
            $workspace,
        ) {
            $document = Document::query()->create([
                'organization_id' => $organization->id,
                'workspace_id' => $workspace->id,
                'created_by' => $request->user()->id,
                'name' => $name,
                'description' => $validated['description'] ?? null,
                'category' => $category,
            ]);
            $workspace->recordActivity();

            return $document;
        });

        return response()->json(
            $this->documentPayload($document, $organization),
            201,
        );
    }

    /** アーカイブ済みの資料は更新できない。 */
    public function update(Request $request, Organization $organization, Document $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertDocumentNotArchived($document);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'body' => ['nullable', 'string', 'max:'.FieldLengthLimits::DOCUMENT_BODY],
            'category' => ['sometimes', 'nullable', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
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

        return response()->json($this->documentPayload($document, $organization));
    }

    /** 組織管理者のみ資料をアーカイブする。 */
    public function archive(Request $request, Organization $organization, Document $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertCanManageArchive($request);

        if ($document->isArchived()) {
            return response()->json(['message' => 'Document is already archived.'], 422);
        }

        $document->archived_at = now();
        $document->save();

        return response()->json($this->documentPayload($document, $organization));
    }

    /** 組織管理者のみアーカイブ済み資料を戻す。 */
    public function unarchive(Request $request, Organization $organization, Document $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertCanManageArchive($request);

        if (! $document->isArchived()) {
            return response()->json(['message' => 'Document is not archived.'], 422);
        }

        $document->archived_at = null;
        $document->save();

        return response()->json($this->documentPayload($document, $organization));
    }

    /** アーカイブ済みの資料だけを完全削除する。組織管理者のみ。 */
    public function destroy(Request $request, Organization $organization, Document $document): JsonResponse
    {
        $this->ensureDocumentBelongsToOrganization($document, $organization);
        $this->assertCanManageArchive($request);

        if (! $document->isArchived()) {
            return response()->json([
                'message' => 'Archive the document before deleting it permanently.',
            ], 422);
        }

        PermanentDeleter::deleteDocument($document);

        return response()->json(null, 204);
    }

    /** メンバーでなければ 403、他組織の資料なら 404。 */
    private function ensureDocumentBelongsToOrganization(Document $document, Organization $organization): void
    {
        $pivot = request()->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        if ($document->organization_id !== $organization->id) {
            abort(404);
        }
    }

    private function assertDocumentNotArchived(Document $document): void
    {
        if ($document->isArchived()) {
            abort(403, 'Cannot update an archived document.');
        }
    }

    /**
     * カテゴリは組織の既定カテゴリに解決して返す。
     *
     * @return array<string, mixed>
     */
    private function documentPayload(Document $document, Organization $organization): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
            'description' => $document->description,
            'body' => $document->body,
            'category' => DefaultDocumentCategories::resolvedCategoryPayload($document, $organization),
            'workspace_id' => (int) $document->workspace_id,
            'archived_at' => $document->archived_at,
            'created_at' => $document->created_at,
            'updated_at' => $document->updated_at,
        ];
    }
}
