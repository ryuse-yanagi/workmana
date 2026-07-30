<?php

namespace App\Support;

use App\Models\SharedDocument;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

final class BidirectionalRelationSync
{
    /**
     * @param array<int, int> $nextRelatedIds
     */
    public static function syncRelatedWorkspaces(Workspace $workspace, array $nextRelatedIds): void
    {
        $previousIds = $workspace->relatedWorkspaces()->pluck('workspaces.id')->map(fn ($id) => (int) $id)->all();
        $nextIds = array_values(array_unique(array_map('intval', $nextRelatedIds)));

        $workspace->relatedWorkspaces()->sync($nextIds);

        $addedIds = array_values(array_diff($nextIds, $previousIds));
        $removedIds = array_values(array_diff($previousIds, $nextIds));

        foreach ($addedIds as $relatedId) {
            DB::table('workspace_related_workspace')->insertOrIgnore([
                'workspace_id' => $relatedId,
                'related_workspace_id' => $workspace->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($removedIds !== []) {
            DB::table('workspace_related_workspace')
                ->where('related_workspace_id', $workspace->id)
                ->whereIn('workspace_id', $removedIds)
                ->delete();
        }
    }

    /**
     * @param array<int, int> $workspaceIds
     */
    public static function attachRelatedWorkspaces(Workspace $workspace, array $workspaceIds): void
    {
        $ids = array_values(array_unique(array_map('intval', $workspaceIds)));
        if ($ids === []) {
            return;
        }

        $workspace->relatedWorkspaces()->syncWithoutDetaching($ids);

        $rows = [];
        $now = now();
        foreach ($ids as $relatedId) {
            $rows[] = [
                'workspace_id' => $relatedId,
                'related_workspace_id' => $workspace->id,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        DB::table('workspace_related_workspace')->insertOrIgnore($rows);
    }

    public static function detachRelatedWorkspace(Workspace $workspace, Workspace $relatedWorkspace): void
    {
        $workspace->relatedWorkspaces()->detach($relatedWorkspace->id);
        $relatedWorkspace->relatedWorkspaces()->detach($workspace->id);
    }

    /**
     * @param array<int, int> $nextRelatedIds
     */
    public static function syncRelatedDocuments(SharedDocument $document, array $nextRelatedIds): void
    {
        $previousIds = $document->relatedDocuments()->pluck('shared_documents.id')->map(fn ($id) => (int) $id)->all();
        $nextIds = array_values(array_unique(array_map('intval', $nextRelatedIds)));

        $document->relatedDocuments()->sync($nextIds);

        $addedIds = array_values(array_diff($nextIds, $previousIds));
        $removedIds = array_values(array_diff($previousIds, $nextIds));

        foreach ($addedIds as $relatedId) {
            DB::table('document_related_document')->insertOrIgnore([
                'document_id' => $relatedId,
                'related_document_id' => $document->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if ($removedIds !== []) {
            DB::table('document_related_document')
                ->where('related_document_id', $document->id)
                ->whereIn('document_id', $removedIds)
                ->delete();
        }
    }

    public static function detachRelatedDocument(SharedDocument $document, SharedDocument $relatedDocument): void
    {
        $document->relatedDocuments()->detach($relatedDocument->id);
        $relatedDocument->relatedDocuments()->detach($document->id);
    }
}
