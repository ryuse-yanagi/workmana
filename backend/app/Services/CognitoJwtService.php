<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class CognitoJwtService
{
    public function verifyAndDecode(string $token): array
    {
        $jwksUrl = config('cognito.jwks_url');
        $issuer = config('cognito.issuer');
        $audience = config('cognito.audience');

        if (! is_string($jwksUrl) || $jwksUrl === ''
            || ! is_string($issuer) || $issuer === ''
            || ! is_string($audience) || $audience === '') {
            throw new RuntimeException('Cognito JWKS URL, issuer, and audience must be configured.');
        }

        $jwksJson = Cache::remember('cognito_jwks', 3600, function () use ($jwksUrl) {
            $response = Http::timeout(10)->get($jwksUrl);
            if (! $response->successful()) {
                throw new RuntimeException('Failed to fetch Cognito JWKS.');
            }

            return $response->body();
        });

        $keys = JWK::parseKeySet(json_decode($jwksJson, true, 512, JSON_THROW_ON_ERROR));
        $decoded = JWT::decode($token, $keys);
        $claims = (array) $decoded;

        if (($claims['iss'] ?? null) !== $issuer) {
            throw new RuntimeException('Invalid token issuer.');
        }

        if (($claims['token_use'] ?? null) !== 'id') {
            throw new RuntimeException('Invalid token_use; an ID token is required.');
        }

        $tokenAud = $claims['aud'] ?? null;
        if (is_array($tokenAud)) {
            if (! in_array($audience, $tokenAud, true)) {
                throw new RuntimeException('Invalid token audience.');
            }
        } elseif ($tokenAud !== $audience) {
            throw new RuntimeException('Invalid token audience.');
        }

        return $claims;
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    public function syncUserFromClaims(array $claims): User
    {
        $sub = $claims['sub'] ?? null;
        if (! is_string($sub) || $sub === '') {
            throw new RuntimeException('Token missing sub claim.');
        }

        $email = $claims['email'] ?? null;
        if (! is_string($email) || $email === '') {
            $email = $claims['username'] ?? null;
        }
        if (! is_string($email) || $email === '') {
            throw new RuntimeException('Token missing email (use ID token or map username).');
        }

        if (! $this->isEmailVerifiedClaim($claims['email_verified'] ?? null)) {
            throw new RuntimeException('Token email is not verified.');
        }

        $email = strtolower(trim($email));

        $user = User::query()->where('cognito_sub', $sub)->first();
        if ($user === null) {
            $byEmail = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
            if ($byEmail !== null) {
                // 既存アカウントへの紐付けは cognito_sub 未設定時のみ。上書きはアカウント乗っ取りになる。
                if ($byEmail->cognito_sub !== null && $byEmail->cognito_sub !== '') {
                    throw new RuntimeException('An account with this email is already linked to a different identity.');
                }
                $user = $byEmail;
            }
        }

        if ($user === null) {
            $user = new User;
            $user->email = $email;
            $user->password = null;
        }

        $user->cognito_sub = $sub;
        $user->email = $email;
        if ($user->email_verified_at === null) {
            $user->email_verified_at = now();
        }
        if (empty($user->name) && isset($claims['name']) && is_string($claims['name'])) {
            $user->name = $claims['name'];
        }
        if ($user->name === null || $user->name === '') {
            $user->name = strstr($email, '@', true) ?: $email;
        }
        $user->save();

        return $user;
    }

    private function isEmailVerifiedClaim(mixed $value): bool
    {
        return $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    public function resolveBypassUser(?string $rawToken): ?User
    {
        if (! config('cognito.bypass')) {
            return null;
        }

        $configuredId = config('cognito.bypass_user_id');
        if ($configuredId !== null && $configuredId !== '') {
            return User::query()->find((int) $configuredId);
        }

        if ($rawToken === null || $rawToken === '') {
            return null;
        }

        if (ctype_digit($rawToken)) {
            return User::query()->find((int) $rawToken);
        }

        Log::warning('Cognito bypass enabled but no user could be resolved.');

        return null;
    }
}
