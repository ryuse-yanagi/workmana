<?php

namespace App\Support\Auth;

use Illuminate\Contracts\Session\Session;

/**
 * Cognito のトークンはサーバー側セッションに置き、ブラウザへはセッション Cookie だけを渡す。
 */
final class CognitoSession
{
    private const USER_ID = 'cognito.user_id';

    private const ACCESS_TOKEN = 'cognito.access_token';

    private const ID_TOKEN = 'cognito.id_token';

    private const REFRESH_TOKEN = 'cognito.refresh_token';

    private const EXPIRES_AT = 'cognito.expires_at';

    private const STATE = 'cognito.state';

    private const CODE_VERIFIER = 'cognito.code_verifier';

    private const INTENDED_PATH = 'cognito.intended_path';

    /**
     * @var list<string>
     */
    private const ALL_KEYS = [
        self::USER_ID,
        self::ACCESS_TOKEN,
        self::ID_TOKEN,
        self::REFRESH_TOKEN,
        self::EXPIRES_AT,
        self::STATE,
        self::CODE_VERIFIER,
        self::INTENDED_PATH,
    ];

    public function __construct(private Session $session) {}

    /**
     * 認可リクエスト開始時の一時情報（state / PKCE verifier / 遷移先）を保存する。
     */
    public function beginAuthorization(string $state, string $codeVerifier, string $intendedPath): void
    {
        $this->session->put(self::STATE, $state);
        $this->session->put(self::CODE_VERIFIER, $codeVerifier);
        $this->session->put(self::INTENDED_PATH, $intendedPath);
    }

    /**
     * コールバックで使い切る一時情報を取り出して削除する。
     *
     * @return array{state: ?string, code_verifier: ?string, intended_path: ?string}
     */
    public function pullAuthorizationRequest(): array
    {
        return [
            'state' => $this->pullString(self::STATE),
            'code_verifier' => $this->pullString(self::CODE_VERIFIER),
            'intended_path' => $this->pullString(self::INTENDED_PATH),
        ];
    }

    /**
     * ログイン成立時にユーザーとトークンを保存する。
     *
     * @param  array{access_token: string, id_token: string, refresh_token: ?string, expires_in: int}  $tokens
     */
    public function establish(int $userId, array $tokens): void
    {
        $this->session->put(self::USER_ID, $userId);
        $this->storeTokens($tokens);
    }

    /**
     * トークンを更新し、新しい refresh_token が無ければ既存の値を残す。
     *
     * @param  array{access_token: string, id_token: string, refresh_token: ?string, expires_in: int}  $tokens
     */
    public function updateTokens(array $tokens): void
    {
        $this->storeTokens($tokens);
    }

    public function userId(): ?int
    {
        $userId = $this->session->get(self::USER_ID);

        return is_int($userId) || (is_string($userId) && ctype_digit($userId))
            ? (int) $userId
            : null;
    }

    public function refreshToken(): ?string
    {
        return $this->readString(self::REFRESH_TOKEN);
    }

    /** 期限が無い、または猶予を引いて切れていれば真。 */
    public function accessTokenExpired(): bool
    {
        $expiresAt = $this->session->get(self::EXPIRES_AT);

        if (! is_int($expiresAt) && ! (is_string($expiresAt) && ctype_digit($expiresAt))) {
            return true;
        }

        return ((int) $expiresAt) - (int) config('cognito.refresh_leeway', 60) <= time();
    }

    public function forget(): void
    {
        $this->session->forget(self::ALL_KEYS);
    }

    /**
     * @param  array{access_token: string, id_token: string, refresh_token: ?string, expires_in: int}  $tokens
     */
    private function storeTokens(array $tokens): void
    {
        $this->session->put(self::ACCESS_TOKEN, $tokens['access_token']);
        $this->session->put(self::ID_TOKEN, $tokens['id_token']);
        $this->session->put(self::EXPIRES_AT, time() + $tokens['expires_in']);

        if ($tokens['refresh_token'] !== null) {
            $this->session->put(self::REFRESH_TOKEN, $tokens['refresh_token']);
        }
    }

    private function readString(string $key): ?string
    {
        $value = $this->session->get($key);

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function pullString(string $key): ?string
    {
        $value = $this->readString($key);
        $this->session->forget($key);

        return $value;
    }
}
