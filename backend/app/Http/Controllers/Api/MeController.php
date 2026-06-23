<?php

namespace App\Http\Controllers\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
            'avatar_url' => $this->avatarUrl($user->avatar_path),
            'organizations' => $user->organizations->map(fn ($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'slug' => $o->slug,
                'work_unit_label' => $o->work_unit_label ?? 'プロジェクト',
                'role' => $o->pivot->role,
            ]),
        ]);
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'avatar' => ['required', 'image', 'max:2048'],
        ]);

        $user = $request->user();
        $oldPath = $user->avatar_path;
        $newPath = $validated['avatar']->store('avatars', 'public');

        $user->avatar_path = $newPath;
        $user->save();

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
        ]);

        $user = $request->user();
        $user->name = trim($validated['name']);
        $user->save();

        return response()->json([
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();
        $oldPath = $user->avatar_path;

        $user->avatar_path = null;
        $user->save();

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'avatar_url' => null,
        ]);
    }
}
