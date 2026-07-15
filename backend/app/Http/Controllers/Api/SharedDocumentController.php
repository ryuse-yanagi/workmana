<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentLabel;
use App\Models\Organization;
use App\Models\SharedDocument;
use App\Support\DefaultDocumentCategories;
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

    /**
     * @return array<string, mixed>
     */
    private function documentPayload(SharedDocument $document, Organization $organization): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
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
