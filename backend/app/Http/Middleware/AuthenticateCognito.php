<?php

namespace App\Http\Middleware;

use App\Services\CognitoJwtService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateCognito
{
    public function __construct(
        private CognitoJwtService $cognitoJwt
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');
        $token = null;
        if (str_starts_with($header, 'Bearer ')) {
            $token = trim(substr($header, 7));
        }

        if ($token === null || $token === '') {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (config('cognito.bypass')) {
            $user = $this->cognitoJwt->resolveBypassUser($token);
            if ($user === null) {
                return response()->json(['message' => 'Bypass mode: set COGNITO_BYPASS_USER_ID or pass numeric user id as Bearer token.'], 401);
            }
            Auth::setUser($user);

            return $next($request);
        }

        try {
            $claims = $this->cognitoJwt->verifyAndDecode($token);
            $user = $this->cognitoJwt->syncUserFromClaims($claims);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Invalid token.'], 401);
        }

        Auth::setUser($user);

        return $next($request);
    }
}
