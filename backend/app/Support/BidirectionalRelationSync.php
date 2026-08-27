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
        DB::transaction(function () use ($workspace, $nextRelatedIds) {
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

            $touchedIds = array_values(array_unique([...$addedIds, ...$removedIds]));
            if ($touchedIds !== []) {
                Workspace::query()
                    ->whereIn('id', $touchedIds)
                    ->get()
                    ->each(fn (Workspace $item) => $item->recordActivity());
            }
        });
    }

    public static function detachRelatedWorkspace(Workspace $workspace, Workspace $relatedWorkspace): void
    {
        DB::transaction(function () use ($workspace, $relatedWorkspace) {
            $workspace->relatedWorkspaces()->detach($relatedWorkspace->id);
            $relatedWorkspace->relatedWorkspaces()->detach($workspace->id);
            $relatedWorkspace->recordActivity();
        });
    }

    /**
     * @param array<int, int> $nextRelatedIds
     */
    public static function syncRelatedDocuments(SharedDocument $document, array $nextRelatedIds): void
    {
        DB::transaction(function () use ($document, $nextRelatedIds) {
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
        });
    }

    public static function detachRelatedDocument(SharedDocument $document, SharedDocument $relatedDocument): void
    {
        DB::transaction(function () use ($document, $relatedDocument) {
            $document->relatedDocuments()->detach($relatedDocument->id);
            $relatedDocument->relatedDocuments()->detach($document->id);
        });
    }
}
