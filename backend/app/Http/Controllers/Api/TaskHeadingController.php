<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\Project;
use App\Models\TaskHeading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskHeadingController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $headings = TaskHeading::query()
            ->where('project_id', $project->id)
            ->orderBy('name')
            ->get(['id', 'name', 'created_at']);

        return response()->json(['data' => $headings]);
    }

    public function store(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:80',
                Rule::unique('task_headings', 'name')->where(fn ($q) => $q->where('project_id', $project->id)),
            ],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Task heading name cannot be empty.'], 422);
        }

        $heading = TaskHeading::query()->create([
            'project_id' => $project->id,
            'created_by' => $request->user()->id,
            'name' => $name,
        ]);

        return response()->json([
            'id' => $heading->id,
            'name' => $heading->name,
            'created_at' => $heading->created_at,
        ], 201);
    }
}
