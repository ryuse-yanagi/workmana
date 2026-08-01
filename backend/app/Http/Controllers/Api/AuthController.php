<?php

namespace App\Http\Controllers\Api;

use App\Services\CognitoJwtService;
use App\Services\CognitoOAuthService;
use App\Services\CognitoSessionAuthenticator;
use App\Services\UserRegistrationService;
use App\Support\CognitoSession;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Cognito Hosted UI との認可コードフロー（PKCE）をバックエンドで完結させ、
 * ブラウザには HttpOnly のセッション Cookie だけを渡す。
 */
class AuthController extends ApiController
{
    public function __construct(
        private CognitoOAuthService $oauth,
        private CognitoJwtService $jwt,
        private CognitoSession $cognitoSession,
        private CognitoSessionAuthenticator $authenticator,
        private UserRegistrationService $registration,
    ) {}

    /**
     * XSRF-TOKEN Cookie を発行するだけのエンドポイント。
     * Cookie 認証では CSRF 対策が必須になるため、更新系リクエストの前に呼ぶ。
     */
    public function csrfCookie(): Response
    {
        return response()->noContent();
    }

    /**
     * 組織に紐付かないアカウント作成。作成後は Cognito ログインが必要。
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
            'email' => ['required', 'string', 'email', 'max:'.FieldLengthLimits::EMAIL],
            'password' => ['required', 'string', 'min:8', 'max:'.FieldLengthLimits::PASSWORD],
        ]);

        try {
            $user = $this->registration->register(
                $validated['name'],
                $validated['email'],
                $validated['password'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'アカウントを作成しました。ログインしてください。',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
            ],
        ], 201);
    }

    /**
     * Hosted UI へリダイレクトする。state と PKCE verifier はセッションにのみ保存する。
     */
    public function login(Request $request): RedirectResponse
    {
        if (! $this->oauth->isConfigured()) {
            return $this->redirectToFrontend('/login', ['error' => 'cognito_not_configured']);
        }

        $state = Str::random(40);
        $codeVerifier = $this->oauth->createCodeVerifier();

        $this->cognitoSession->beginAuthorization(
            $state,
            $codeVerifier,
            $this->safeRedirectPath($request->query('next'))
        );

        return redirect()->away($this->oauth->authorizationUrl(
            $state,
            $this->oauth->codeChallengeFor($codeVerifier)
        ));
    }

    /**
     * Cognito からのコールバック。認可コードをサーバー側でトークンへ交換し、
     * セッションを確立してからフロントエンドへ戻す。
     */
    public function callback(Request $request): RedirectResponse
    {
        $authorization = $this->cognitoSession->pullAuthorizationRequest();
        $intendedPath = $this->safeRedirectPath($authorization['intended_path']);

        if ($request->query('error') !== null) {
            return $this->redirectToFrontend('/login', ['error' => 'cognito_denied']);
        }

        $code = $request->query('code');
        $state = $request->query('state');

        if (! is_string($code) || $code === '' || ! is_string($state) || $state === '') {
            return $this->redirectToFrontend('/login', ['error' => 'invalid_callback']);
        }

        // CSRF / リプレイ対策。開始時に発行した state と一致しなければ破棄する。
        if ($authorization['state'] === null || ! hash_equals($authorization['state'], $state)) {
            return $this->redirectToFrontend('/login', ['error' => 'state_mismatch']);
        }

        if ($authorization['code_verifier'] === null) {
            return $this->redirectToFrontend('/login', ['error' => 'state_mismatch']);
        }

        try {
            $tokens = $this->oauth->exchangeAuthorizationCode($code, $authorization['code_verifier']);
            $claims = $this->jwt->verifyAndDecode($tokens['id_token']);
            $user = $this->jwt->syncUserFromClaims($claims);
        } catch (Throwable $e) {
            report($e);

            return $this->redirectToFrontend('/login', ['error' => 'login_failed']);
        }

        // セッション固定攻撃を防ぐため、認証成立時に ID を再生成する。
        $request->session()->regenerate();
        $this->cognitoSession->establish((int) $user->id, $tokens);

        return $this->redirectToFrontend($intendedPath);
    }

    /**
     * セッションを破棄し、Hosted UI のログアウト URL を返す。
     */
    public function logout(Request $request): JsonResponse
    {
        $refreshToken = $this->cognitoSession->refreshToken();

        try {
            if ($refreshToken !== null) {
                $this->oauth->revokeRefreshToken($refreshToken);
            }
        } catch (Throwable $e) {
            // Cognito が一時的に応答しなくても、ローカルセッションは必ず破棄する。
            report($e);
        } finally {
            $this->cognitoSession->forget();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'logout_url' => $this->oauth->logoutUrl(),
        ]);
    }

    /**
     * 認証状態とユーザー情報を返す。未認証でも 200 を返し、フロントは JWT を解析しない。
     */
    public function session(Request $request): JsonResponse
    {
        $user = $this->authenticator->resolve($request);

        return response()->json([
            'authenticated' => $user !== null,
            'configured' => $this->oauth->isConfigured(),
            'user' => $user !== null ? $this->userPayload($user) : null,
        ]);
    }

    /**
     * @param  array<string, string>  $query
     */
    private function redirectToFrontend(string $path, array $query = []): RedirectResponse
    {
        $url = (string) config('cognito.frontend_url').$path;

        if ($query !== []) {
            $url .= (str_contains($path, '?') ? '&' : '?').http_build_query($query);
        }

        return redirect()->away($url);
    }

    /**
     * オープンリダイレクト対策。自サイト配下の絶対パスだけを許可する。
     */
    private function safeRedirectPath(mixed $path): string
    {
        $default = (string) config('cognito.default_redirect_path', '/');

        if (! is_string($path) || $path === '' || ! str_starts_with($path, '/')) {
            return $default;
        }

        // "//example.com" や "/\example.com" はブラウザが外部オリジンとして解釈する。
        if (str_starts_with($path, '//') || str_starts_with($path, '/\\')) {
            return $default;
        }

        return $path;
    }
}
