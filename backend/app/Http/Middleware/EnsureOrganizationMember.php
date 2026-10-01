<?php

namespace App\Http\Middleware;

use App\Models\Organization\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOrganizationMember
{
    /**
     * 未所属なら 403 にし、所属なら pivot をリクエスト属性に載せる。
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Organization $organization */
        $organization = $request->route('organization');
        $user = $request->user();

        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $org = $user->organizations()->where('organizations.id', $organization->id)->first();
        if ($org === null) {
            return response()->json(['message' => 'Forbidden for this organization.'], 403);
        }

        $request->attributes->set('organization_membership', $org->pivot);

        return $next($request);
    }
}
