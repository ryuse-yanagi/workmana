<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Cognito Hosted UI との認可コードフロー（PKCE）を扱う。
 * トークンエンドポイントとの通信はサーバーサイドのみで完結させ、
 * トークンがブラウザへ渡らないようにする。
 */
class CognitoOAuthService
{
    /**
     * @var list<string>
     */
    private const READ_ONLY_TOKEN_KEYS = ['access_token', 'id_token', 'refresh_token'];

    public function isConfigured(): bool
    {
        return $this->domain() !== ''
            && $this->clientId() !== ''
            && $this->redirectUri() !== ''
            && (string) config('cognito.jwks_url', '') !== ''
            && (string) config('cognito.issuer', '') !== ''
            && (string) config('cognito.audience', '') !== '';
    }

    public function createCodeVerifier(): string
    {
        return $this->base64Url(random_bytes(64));
    }

    public function codeChallengeFor(string $codeVerifier): string
    {
        return $this->base64Url(hash('sha256', $codeVerifier, true));
    }

    public function authorizationUrl(string $state, string $codeChallenge): string
    {
        $this->assertConfigured();

        /** @var list<string> $scopes */
        $scopes = (array) config('cognito.scopes', []);

        return $this->domain().'/oauth2/authorize?'.http_build_query([
            'response_type' => 'code',
            'client_id' => $this->clientId(),
            'redirect_uri' => $this->redirectUri(),
            'scope' => implode(' ', $scopes),
            'state' => $state,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
        ]);
    }

    /**
     * Hosted UI のログアウト URL。未設定の場合は null。
     */
    public function logoutUrl(): ?string
    {
        $logoutRedirectUri = (string) config('cognito.logout_redirect_uri', '');

        if ($this->domain() === '' || $this->clientId() === '' || $logoutRedirectUri === '') {
            return null;
        }

        return $this->domain().'/logout?'.http_build_query([
            'client_id' => $this->clientId(),
            'logout_uri' => $logoutRedirectUri,
        ]);
    }

    /**
     * 認可コードをトークンへ交換する。
     *
     * @return array{access_token: string, id_token: string, refresh_token: ?string, expires_in: int}
     */
    public function exchangeAuthorizationCode(string $code, string $codeVerifier): array
    {
        return $this->requestToken([
            'grant_type' => 'authorization_code',
            'client_id' => $this->clientId(),
            'code' => $code,
            'redirect_uri' => $this->redirectUri(),
            'code_verifier' => $codeVerifier,
        ]);
    }

    /**
     * リフレッシュトークンでアクセストークン・ID トークンを更新する。
     * Cognito はレスポンスに refresh_token を含めないため、呼び出し側で既存の値を保持する。
     *
     * @return array{access_token: string, id_token: string, refresh_token: ?string, expires_in: int}
     */
    public function refreshTokens(string $refreshToken): array
    {
        return $this->requestToken([
            'grant_type' => 'refresh_token',
            'client_id' => $this->clientId(),
            'refresh_token' => $refreshToken,
        ]);
    }

    /**
     * Cognito 側のリフレッシュトークンを明示的に失効させる。
     */
    public function revokeRefreshToken(string $refreshToken): void
    {
        $this->assertConfigured();

        $request = Http::asForm()->timeout(10);

        $clientSecret = (string) config('cognito.client_secret', '');
        if ($clientSecret !== '') {
            $request = $request->withBasicAuth($this->clientId(), $clientSecret);
        }

        $response = $request->post($this->domain().'/oauth2/revoke', [
            'token' => $refreshToken,
            'client_id' => $this->clientId(),
        ]);

        if (! $response->successful()) {
            throw new RuntimeException('Cognito revoke endpoint responded with HTTP '.$response->status().'.');
        }
    }

    /**
     * @param  array<string, string>  $payload
     * @return array{access_token: string, id_token: string, refresh_token: ?string, expires_in: int}
     */
    private function requestToken(array $payload): array
    {
        $this->assertConfigured();

        $request = Http::asForm()->timeout(10);

        $clientSecret = (string) config('cognito.client_secret', '');
        if ($clientSecret !== '') {
            $request = $request->withBasicAuth($this->clientId(), $clientSecret);
        }

        $response = $request->post($this->domain().'/oauth2/token', $payload);

        if (! $response->successful()) {
            throw new RuntimeException('Cognito token endpoint responded with HTTP '.$response->status().'.');
        }

        /** @var array<string, mixed> $data */
        $data = (array) $response->json();

        foreach (['access_token', 'id_token'] as $required) {
            if (! isset($data[$required]) || ! is_string($data[$required]) || $data[$required] === '') {
                throw new RuntimeException('Cognito token response is missing "'.$required.'".');
            }
        }

        foreach (self::READ_ONLY_TOKEN_KEYS as $key) {
            if (isset($data[$key]) && ! is_string($data[$key])) {
                throw new RuntimeException('Cognito token response contains a malformed "'.$key.'".');
            }
        }

        $refreshToken = isset($data['refresh_token']) && $data['refresh_token'] !== ''
            ? (string) $data['refresh_token']
            : null;

        return [
            'access_token' => (string) $data['access_token'],
            'id_token' => (string) $data['id_token'],
            'refresh_token' => $refreshToken,
            'expires_in' => (int) ($data['expires_in'] ?? 3600),
        ];
    }

    private function assertConfigured(): void
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException(
                'Cognito is not configured (domain, client ID, redirect URI, JWKS URL, issuer, and audience are required).'
            );
        }
    }

    private function domain(): string
    {
        return rtrim((string) config('cognito.domain', ''), '/');
    }

    private function clientId(): string
    {
        return (string) config('cognito.client_id', '');
    }

    private function redirectUri(): string
    {
        return (string) config('cognito.redirect_uri', '');
    }

    private function base64Url(string $binary): string
    {
        return rtrim(strtr(base64_encode($binary), '+/', '-_'), '=');
    }
}
