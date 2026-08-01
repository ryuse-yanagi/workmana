<?php

namespace App\Http\Middleware;

use App\Services\CognitoSessionAuthenticator;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * HttpOnly のセッション Cookie でリクエストを認証する。
 * JWT はサーバー側セッションにのみ保持され、Authorization ヘッダーは受け付けない。
 */
class AuthenticateCognito
{
    public function __construct(
        private CognitoSessionAuthenticator $authenticator
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $this->authenticator->resolve($request);

        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        Auth::setUser($user);

        return $next($request);
    }
}
