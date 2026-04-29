<?php

namespace App\Http\Controllers\Api;

use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $lists = $project->lists()->get(['id', 'name', 'sort_order', 'created_at']);

        return response()->json(['data' => $lists]);
    }

    public function store(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $list = $project->lists()->create([
            'name' => $name,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json([
            'id' => $list->id,
            'name' => $list->name,
            'sort_order' => $list->sort_order,
        ], 201);
    }

    public function update(Request $request, Organization $organization, Project $project, BoardList $boardList): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $boardList->project_id !== (int) $project->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Name cannot be empty.'], 422);
            }
            $boardList->name = $name;
        }
        if (array_key_exists('sort_order', $validated)) {
            $boardList->sort_order = $validated['sort_order'];
        }
        $boardList->save();

        return response()->json([
            'id' => $boardList->id,
            'name' => $boardList->name,
            'sort_order' => $boardList->sort_order,
        ]);
    }

    public function destroy(Request $request, Organization $organization, Project $project, BoardList $boardList): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $boardList->project_id !== (int) $project->id) {
            abort(404);
        }

        $boardList->delete();

        return response()->json(null, 204);
    }
}
