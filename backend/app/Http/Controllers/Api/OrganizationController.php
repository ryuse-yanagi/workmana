<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrganizationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('organizations');

        return response()->json([
            'data' => $user->organizations->map(fn ($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'slug' => $o->slug,
                'role' => $o->pivot->role,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:100',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('organizations', 'slug'),
            ],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $user = $request->user();

        $org = Organization::query()->create([
            'name' => $name,
            'slug' => Str::lower($validated['slug']),
            'created_by' => $user->id,
        ]);

        $org->members()->attach($user->id, [
            'role' => 'admin',
            'invited_by' => null,
        ]);

        return response()->json([
            'id' => $org->id,
            'name' => $org->name,
            'slug' => $org->slug,
        ], 201);
    }
}
