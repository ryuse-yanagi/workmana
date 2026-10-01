<?php

namespace App\Services\Auth;

use Aws\CognitoIdentityProvider\CognitoIdentityProviderClient;
use Aws\CognitoIdentityProvider\Exception\CognitoIdentityProviderException;
use Aws\Result;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class CognitoUserRegistrationService
{
    /**
     * Cognito に登録して sub を返す。bypass 時はローカル用の疑似 sub。
     */
    public function register(string $email, string $password, string $name): ?string
    {
        if (config('cognito.bypass')) {
            return 'local-'.Str::uuid()->toString();
        }

        $userPoolId = (string) config('cognito.user_pool_id', '');
        if ($userPoolId !== '') {
            return $this->adminCreateUser($userPoolId, $email, $password, $name);
        }

        $clientId = (string) config('cognito.client_id', '');
        if ($clientId === '') {
            throw new RuntimeException('Cognito client is not configured for user registration.');
        }

        return $this->publicSignUp($clientId, $email, $password, $name);
    }

    /** 招待メールを出さず作成し、パスワード設定に失敗したらそのユーザーを消す。 */
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
            $this->deleteCreatedUser($client, $userPoolId, $email);
            if ($e->getAwsErrorCode() === 'InvalidPasswordException') {
                throw new RuntimeException('パスワードが Cognito の要件を満たしていません。', 0, $e);
            }
            Log::error('Cognito AdminSetUserPassword failed', [
                'code' => $e->getAwsErrorCode(),
                'message' => $e->getMessage(),
            ]);
            throw new RuntimeException('Cognito でのパスワード設定に失敗しました。', 0, $e);
        }

        return $this->resolveSub($client, $userPoolId, $email, $result);
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

        return $sub;
    }

    /**
     * 作成結果に sub が無ければ AdminGetUser で取る。
     *
     * @param  Result<array<string, mixed>>  $createResult
     */
    private function resolveSub(
        CognitoIdentityProviderClient $client,
        string $userPoolId,
        string $username,
        $createResult,
    ): string {
        $sub = $createResult->search('User.Attributes[?Name==`sub`].Value | [0]');
        if ($this->isCognitoSub($sub)) {
            return $sub;
        }

        try {
            $user = $client->adminGetUser([
                'UserPoolId' => $userPoolId,
                'Username' => $username,
            ]);
        } catch (CognitoIdentityProviderException $e) {
            Log::error('Cognito AdminGetUser failed while resolving sub', [
                'code' => $e->getAwsErrorCode(),
                'message' => $e->getMessage(),
            ]);
            throw new RuntimeException('Cognito user sub could not be resolved.', 0, $e);
        }

        foreach ($user->get('UserAttributes') ?? [] as $attribute) {
            if (($attribute['Name'] ?? '') === 'sub' && $this->isCognitoSub($attribute['Value'] ?? null)) {
                return $attribute['Value'];
            }
        }

        throw new RuntimeException('Cognito user sub could not be resolved.');
    }

    private function isCognitoSub(mixed $value): bool
    {
        return is_string($value)
            && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) === 1;
    }

    /** パスワード設定失敗後の後始末。削除に失敗しても例外は出さない。 */
    private function deleteCreatedUser(CognitoIdentityProviderClient $client, string $userPoolId, string $username): void
    {
        try {
            $client->adminDeleteUser([
                'UserPoolId' => $userPoolId,
                'Username' => $username,
            ]);
        } catch (CognitoIdentityProviderException $e) {
            Log::warning('Cognito AdminDeleteUser failed after password setup error', [
                'code' => $e->getAwsErrorCode(),
                'message' => $e->getMessage(),
            ]);
        }
    }

    private function adminClient(): CognitoIdentityProviderClient
    {
        return new CognitoIdentityProviderClient([
            'version' => '2016-04-18',
            'region' => (string) config('cognito.region', 'ap-northeast-1'),
        ]);
    }
}
