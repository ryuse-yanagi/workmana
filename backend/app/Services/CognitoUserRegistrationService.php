<?php

namespace App\Services;

use Aws\CognitoIdentityProvider\CognitoIdentityProviderClient;
use Aws\CognitoIdentityProvider\Exception\CognitoIdentityProviderException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class CognitoUserRegistrationService
{
    /**
     * Cognito にユーザーを登録し、UserSub を返す。
     * bypass 時や User Pool 未設定時はローカル用の疑似 sub を返す。
     */
    public function register(string $email, string $password, string $name): ?string
    {
        if (config('cognito.bypass')) {
            return 'local-'.Str::uuid()->toString();
        }

        $userPoolId = (string) config('cognito.user_pool_id', '');
        $clientId = (string) config('cognito.client_id', '');

        if ($userPoolId !== '' && $this->hasAwsCredentials()) {
            return $this->adminCreateUser($userPoolId, $email, $password, $name);
        }

        if ($clientId === '') {
            throw new RuntimeException('Cognito client is not configured for user registration.');
        }

        return $this->publicSignUp($clientId, $email, $password, $name);
    }

    private function hasAwsCredentials(): bool
    {
        $key = (string) env('AWS_ACCESS_KEY_ID', '');
        $secret = (string) env('AWS_SECRET_ACCESS_KEY', '');

        return $key !== '' && $secret !== '';
    }

    private function adminCreateUser(string $userPoolId, string $email, string $password, string $name): string
    {
        $client = $this->adminClient();

        try {
            $result = $client->adminCreateUser([
                'UserPoolId' => $userPoolId,
                'Username' => $email,
                'UserAttributes' => [
                    ['Name' => 'email', 'Value' => $email],
                    ['Name' => 'email_verified', 'Value' => 'true'],
                    ['Name' => 'name', 'Value' => $name],
                ],
                'MessageAction' => 'SUPPRESS',
            ]);
        } catch (CognitoIdentityProviderException $e) {
            if ($e->getAwsErrorCode() === 'UsernameExistsException') {
                throw new RuntimeException('このメールアドレスは既に登録されています。', 0, $e);
            }
            Log::error('Cognito AdminCreateUser failed', [
                'code' => $e->getAwsErrorCode(),
                'message' => $e->getMessage(),
            ]);
            throw new RuntimeException('Cognito へのユーザー登録に失敗しました。', 0, $e);
        }

        try {
            $client->adminSetUserPassword([
                'UserPoolId' => $userPoolId,
                'Username' => $email,
                'Password' => $password,
                'Permanent' => true,
            ]);
        } catch (CognitoIdentityProviderException $e) {
            Log::error('Cognito AdminSetUserPassword failed', [
                'code' => $e->getAwsErrorCode(),
                'message' => $e->getMessage(),
            ]);
            throw new RuntimeException('Cognito でのパスワード設定に失敗しました。', 0, $e);
        }

        $sub = $result->search('User.Attributes[?Name==`sub`].Value | [0]');
        if (! is_string($sub) || $sub === '') {
            $sub = $result->get('User')['Username'] ?? null;
        }
        if (! is_string($sub) || $sub === '') {
            throw new RuntimeException('Cognito user sub could not be resolved.');
        }

        return $sub;
    }

    private function publicSignUp(string $clientId, string $email, string $password, string $name): string
    {
        $region = (string) config('cognito.region', 'ap-northeast-1');
        $endpoint = "https://cognito-idp.{$region}.amazonaws.com/";

        $response = Http::withHeaders([
            'Content-Type' => 'application/x-amz-json-1.1',
            'X-Amz-Target' => 'AWSCognitoIdentityProviderService.SignUp',
        ])->post($endpoint, [
            'ClientId' => $clientId,
            'Username' => $email,
            'Password' => $password,
            'UserAttributes' => [
                ['Name' => 'email', 'Value' => $email],
                ['Name' => 'name', 'Value' => $name],
            ],
        ]);

        if ($response->status() === 400) {
            $type = (string) $response->json('__type', '');
            if (str_contains($type, 'UsernameExistsException')) {
                throw new RuntimeException('このメールアドレスは既に登録されています。');
            }
            if (str_contains($type, 'InvalidPasswordException')) {
                throw new RuntimeException('パスワードが Cognito の要件を満たしていません。');
            }
            Log::warning('Cognito SignUp rejected', ['body' => $response->json()]);
            throw new RuntimeException('Cognito へのユーザー登録に失敗しました。');
        }

        if (! $response->successful()) {
            Log::error('Cognito SignUp failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException('Cognito へのユーザー登録に失敗しました。');
        }

        $sub = $response->json('UserSub');
        if (! is_string($sub) || $sub === '') {
            throw new RuntimeException('Cognito user sub could not be resolved.');
        }

        $userPoolId = (string) config('cognito.user_pool_id', '');
        if ($userPoolId !== '' && $this->hasAwsCredentials() && ! (bool) $response->json('UserConfirmed')) {
            try {
                $this->adminClient()->adminConfirmSignUp([
                    'UserPoolId' => $userPoolId,
                    'Username' => $email,
                ]);
                $this->adminClient()->adminUpdateUserAttributes([
                    'UserPoolId' => $userPoolId,
                    'Username' => $email,
                    'UserAttributes' => [
                        ['Name' => 'email_verified', 'Value' => 'true'],
                    ],
                ]);
            } catch (CognitoIdentityProviderException $e) {
                Log::warning('Cognito AdminConfirmSignUp failed after SignUp', [
                    'code' => $e->getAwsErrorCode(),
                    'message' => $e->getMessage(),
                ]);
            }
        }

        return $sub;
    }

    private function adminClient(): CognitoIdentityProviderClient
    {
        return new CognitoIdentityProviderClient([
            'version' => '2016-04-18',
            'region' => (string) config('cognito.region', 'ap-northeast-1'),
        ]);
    }
}
