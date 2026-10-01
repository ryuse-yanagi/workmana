<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Support\Auth\CognitoSession;
use Illuminate\Http\Request;
use Throwable;

/** ミドルウェアと認証状態 API が、HttpOnly セッションからユーザーを解決する。 */
class CognitoSessionAuthenticator
{
    public function __construct(
        private CognitoSession $cognitoSession,
        private CognitoOAuthService $oauth,
        private CognitoJwtService $jwt,
    ) {}

    /**
     * 認証できない場合は null を返す。期限切れトークンは可能ならリフレッシュする。
     */
    public function resolve(Request $request): ?User
    {
        $bypassUser = $this->resolveBypassUser($request);
        if ($bypassUser !== null) {
            return $bypassUser;
        }

        if (! $request->hasSession()) {
            return null;
        }

        $userId = $this->cognitoSession->userId();
        if ($userId === null) {
            return null;
        }

        $user = User::query()->find($userId);
        if ($user === null) {
            $this->cognitoSession->forget();

            return null;
        }

        if (! $this->ensureFreshTokens($user)) {
            $this->cognitoSession->forget();

            return null;
        }

        return $user;
    }

    /**
     * ローカル・テスト専用の抜け道。COGNITO_BYPASS が false（本番想定）なら常に無効。
     */
    private function resolveBypassUser(Request $request): ?User
    {
        if (! config('cognito.bypass')) {
            return null;
        }

        return $this->jwt->resolveBypassUser($request->bearerToken());
    }

    /**
     * Cognito 側でセッションが失効していればリフレッシュに失敗し、アプリのセッションも無効化される。
     */
    private function ensureFreshTokens(User $user): bool
    {
        if (! $this->cognitoSession->accessTokenExpired()) {
            return true;
        }

        $refreshToken = $this->cognitoSession->refreshToken();
        if ($refreshToken === null) {
            return false;
        }

        try {
            $tokens = $this->oauth->refreshTokens($refreshToken);

            // 署名、期限、iss、aud、token_use を確認し、別ユーザーのトークンへの置換は拒否する。
            $claims = $this->jwt->verifyAndDecode($tokens['id_token']);
            if (($claims['sub'] ?? null) !== $user->cognito_sub) {
                return false;
            }

            $this->cognitoSession->updateTokens($tokens);
        } catch (Throwable $e) {
            report($e);

            return false;
        }

        return true;
    }
}
