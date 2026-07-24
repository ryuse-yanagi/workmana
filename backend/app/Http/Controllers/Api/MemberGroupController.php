<?php

namespace App\Http\Controllers\Api;

use App\Models\MemberGroup;
use App\Models\Organization;
use App\Support\BoardListColors;
use App\Support\FieldLengthLimits;
use App\Support\SortOrderReorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MemberGroupController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $groups = MemberGroup::query()
            ->where('organization_id', $organization->id)
            ->with('members')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $groups->map(fn (MemberGroup $group) => $this->groupPayload($group))->values(),
        ]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->assertAdmin($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::MEMBER_GROUP_NAME],
            'color_index' => ['nullable', 'integer', 'min:0', 'max:'.(BoardListColors::STANDARD_COUNT - 1)],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Member group name cannot be empty.'], 422);
        }

        $exists = MemberGroup::query()
            ->where('organization_id', $organization->id)
            ->where('name', $name)
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'A member group with this name already exists.'], 422);
        }

        $colorIndex = (int) ($validated['color_index'] ?? BoardListColors::DEFAULT_INDEX);
        if (! BoardListColors::isValidIndex($colorIndex)) {
            return response()->json(['message' => 'Invalid color index.'], 422);
        }

        $memberIds = $this->validatedOrgMemberIds(
            $organization,
            array_map('intval', $validated['member_ids'] ?? []),
        );

        $groupCount = MemberGroup::query()
            ->where('organization_id', $organization->id)
            ->count();
        if ($groupCount >= 20) {
            return response()->json(['message' => 'Member groups are limited to 20 per organization.'], 422);
        }

        $maxOrder = MemberGroup::query()
            ->where('organization_id', $organization->id)
            ->max('sort_order');

        $group = DB::transaction(function () use ($organization, $request, $name, $colorIndex, $maxOrder, $memberIds) {
            $group = MemberGroup::query()->create([
                'organization_id' => $organization->id,
                'created_by' => $request->user()->id,
                'name' => $name,
                'color_index' => $colorIndex,
                'sort_order' => $maxOrder === null ? 0 : ((int) $maxOrder + 1),
            ]);
            $this->syncMembers($group, $memberIds);

            return $group;
        });

        $group->load('members');

        return response()->json($this->groupPayload($group), 201);
    }

    public function update(Request $request, Organization $organization, MemberGroup $memberGroup): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureGroupBelongsToOrganization($memberGroup, $organization);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::MEMBER_GROUP_NAME],
            'color_index' => ['sometimes', 'integer', 'min:0', 'max:'.(BoardListColors::STANDARD_COUNT - 1)],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Member group name cannot be empty.'], 422);
            }
            $exists = MemberGroup::query()
                ->where('organization_id', $organization->id)
                ->where('name', $name)
                ->where('id', '!=', $memberGroup->id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'A member group with this name already exists.'], 422);
            }
            $memberGroup->name = $name;
        }

        if (array_key_exists('color_index', $validated)) {
            $colorIndex = (int) $validated['color_index'];
            if (! BoardListColors::isValidIndex($colorIndex)) {
                return response()->json(['message' => 'Invalid color index.'], 422);
            }
            $memberGroup->color_index = $colorIndex;
        }

        if (array_key_exists('sort_order', $validated)) {
            $memberGroup->sort_order = (int) $validated['sort_order'];
        }

        DB::transaction(function () use ($memberGroup, $organization, $validated) {
            $memberGroup->save();
            if (array_key_exists('member_ids', $validated)) {
                $memberIds = $this->validatedOrgMemberIds(
                    $organization,
                    array_map('intval', $validated['member_ids']),
                );
                $this->syncMembers($memberGroup, $memberIds);
            }
        });

        $memberGroup->load('members');

        return response()->json($this->groupPayload($memberGroup));
    }

    public function reorder(Request $request, Organization $organization): JsonResponse
    {
        $this->assertAdmin($request);

        $validated = $request->validate([
            'group_ids' => ['present', 'array'],
            'group_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var list<int> $groupIds */
        $groupIds = array_map('intval', $validated['group_ids']);

        $activeGroupIds = MemberGroup::query()
            ->where('organization_id', $organization->id)
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        SortOrderReorder::assertExactIdSet(
            $groupIds,
            $activeGroupIds,
            'group_ids',
            'group_ids must include every member group exactly once.',
        );

        SortOrderReorder::apply(
            MemberGroup::query()->where('organization_id', $organization->id),
            $groupIds,
        );

        return response()->json(['data' => ['ok' => true]]);
    }

    public function reorderMembers(Request $request, Organization $organization, MemberGroup $memberGroup): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureGroupBelongsToOrganization($memberGroup, $organization);

        $validated = $request->validate([
            'member_ids' => ['present', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var list<int> $memberIds */
        $memberIds = array_map('intval', $validated['member_ids']);

        $activeMemberIds = $memberGroup->members()
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->sort()
            ->values()
            ->all();

        SortOrderReorder::assertExactIdSet(
            $memberIds,
            $activeMemberIds,
            'member_ids',
            'member_ids must include every group member exactly once.',
        );

        DB::transaction(function () use ($memberGroup, $memberIds) {
            foreach ($memberIds as $index => $userId) {
                DB::table('member_group_user')
                    ->where('member_group_id', $memberGroup->id)
                    ->where('user_id', $userId)
                    ->update(['sort_order' => $index]);
            }
        });

        return response()->json(['data' => ['ok' => true]]);
    }

    public function destroy(Request $request, Organization $organization, MemberGroup $memberGroup): JsonResponse
    {
        $this->assertAdmin($request);
        $this->ensureGroupBelongsToOrganization($memberGroup, $organization);

        $memberGroup->delete();

        return response()->json(null, 204);
    }

    private function assertAdmin(Request $request): void
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can manage member groups.');
        }
    }

    private function ensureGroupBelongsToOrganization(MemberGroup $memberGroup, Organization $organization): void
    {
        if ((int) $memberGroup->organization_id !== (int) $organization->id) {
            abort(404);
        }
    }

    /**
     * @param  list<int>  $memberIds
     */
    private function syncMembers(MemberGroup $group, array $memberIds): void
    {
        $syncData = [];
        foreach ($memberIds as $index => $memberId) {
            $syncData[$memberId] = ['sort_order' => $index];
        }
        $group->members()->sync($syncData);
    }

    /**
     * @param  list<int>  $memberIds
     * @return list<int>
     */
    private function validatedOrgMemberIds(Organization $organization, array $memberIds): array
    {
        if ($memberIds === []) {
            return [];
        }

        $orgMemberIds = $organization->members()
            ->whereIn('users.id', $memberIds)
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        sort($orgMemberIds);
        $sortedIncoming = $memberIds;
        sort($sortedIncoming);

        if ($sortedIncoming !== $orgMemberIds) {
            abort(422, 'member_ids must only include organization members.');
        }

        return array_values(array_unique($memberIds));
    }

    /**
     * @return array<string, mixed>
     */
    private function groupPayload(MemberGroup $group): array
    {
        return [
            'id' => $group->id,
            'name' => $group->name,
            'color_index' => (int) $group->color_index,
            'sort_order' => (int) $group->sort_order,
            'members' => $group->members->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $this->avatarUrl($user->avatar_path),
            ])->values()->all(),
        ];
    }
}
