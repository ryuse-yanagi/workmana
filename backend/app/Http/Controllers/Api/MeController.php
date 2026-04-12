<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends ApiController
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('organizations');

        return response()->json([
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'organizations' => $user->organizations->map(fn ($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'slug' => $o->slug,
                'role' => $o->pivot->role,
            ]),
        ]);
    }
}
