<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\Project;
use App\Models\Section;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SectionController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $sections = $project->sections()->get(['id', 'name', 'sort_order', 'created_at']);

        return response()->json(['data' => $sections]);
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

        $section = $project->sections()->create([
            'name' => $name,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json([
            'id' => $section->id,
            'name' => $section->name,
            'sort_order' => $section->sort_order,
        ], 201);
    }

    public function update(Request $request, Organization $organization, Project $project, Section $section): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $section->project_id !== (int) $project->id) {
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
            $section->name = $name;
        }
        if (array_key_exists('sort_order', $validated)) {
            $section->sort_order = $validated['sort_order'];
        }
        $section->save();

        return response()->json([
            'id' => $section->id,
            'name' => $section->name,
            'sort_order' => $section->sort_order,
        ]);
    }

    public function destroy(Request $request, Organization $organization, Project $project, Section $section): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $section->project_id !== (int) $project->id) {
            abort(404);
        }

        $section->delete();

        return response()->json(null, 204);
    }
}
