<?php

namespace Tests\Unit\Auth;

use App\Models\User;
use App\Services\Auth\CognitoJwtService;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class CognitoJwtServiceTest extends TestCase
{
    use RefreshDatabase;

    private string $privateKey;

    protected function setUp(): void
    {
        parent::setUp();

        $key = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $this->assertNotFalse($key);
        $privateKey = '';
        $this->assertTrue(openssl_pkey_export($key, $privateKey));
        $this->privateKey = $privateKey;

        $details = openssl_pkey_get_details($key);
        $this->assertIsArray($details);

        Http::fake([
            'cognito.example.com/.well-known/jwks.json' => Http::response([
                'keys' => [[
                    'kty' => 'RSA',
                    'kid' => 'test-key',
                    'use' => 'sig',
                    'alg' => 'RS256',
                    'n' => $this->base64Url($details['rsa']['n']),
                    'e' => $this->base64Url($details['rsa']['e']),
                ]],
            ]),
        ]);

        config([
            'cognito.jwks_url' => 'https://cognito.example.com/.well-known/jwks.json',
            'cognito.issuer' => 'https://cognito.example.com/pool',
            'cognito.audience' => 'client-id',
        ]);
        Cache::forget('cognito_jwks');
    }

    /** 有効なIDトークンは受け入れられる */
    public function test_valid_id_token_is_accepted(): void
    {
        $claims = app(CognitoJwtService::class)->verifyAndDecode($this->token());

        $this->assertSame('id', $claims['token_use']);
        $this->assertSame('client-id', $claims['aud']);
    }

    /** 署名が正しくてもaccessトークンは拒否される */
    public function test_access_token_is_rejected_even_when_signature_is_valid(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('token_use');

        app(CognitoJwtService::class)->verifyAndDecode($this->token([
            'token_use' => 'access',
        ]));
    }

    /** 誤ったaudienceのトークンは拒否される */
    public function test_wrong_audience_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('audience');

        app(CognitoJwtService::class)->verifyAndDecode($this->token([
            'aud' => 'another-client',
        ]));
    }

    /** audience設定がない場合は拒否される */
    public function test_missing_audience_configuration_is_rejected(): void
    {
        config(['cognito.audience' => '']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('audience must be configured');

        app(CognitoJwtService::class)->verifyAndDecode($this->token());
    }

    /** 未検証メールの同期は拒否される */
    public function test_sync_rejects_unverified_email(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('email is not verified');

        app(CognitoJwtService::class)->syncUserFromClaims([
            'sub' => 'new-sub',
            'email' => 'user@example.com',
            'email_verified' => false,
        ]);
    }

    /** 未紐づけのメールアカウントが同期で紐づく */
    public function test_sync_links_unbound_email_account(): void
    {
        $existing = User::factory()->create([
            'email' => 'linkme@example.com',
            'cognito_sub' => null,
        ]);

        $user = app(CognitoJwtService::class)->syncUserFromClaims([
            'sub' => 'linked-sub',
            'email' => 'linkme@example.com',
            'email_verified' => true,
            'name' => 'Linked',
        ]);

        $this->assertSame($existing->id, $user->id);
        $this->assertSame('linked-sub', $user->fresh()->cognito_sub);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    /** 既存のcognito_subは上書きされない */
    public function test_sync_does_not_overwrite_existing_cognito_sub(): void
    {
        User::factory()->create([
            'email' => 'taken@example.com',
            'cognito_sub' => 'original-sub',
        ]);

        try {
            app(CognitoJwtService::class)->syncUserFromClaims([
                'sub' => 'attacker-sub',
                'email' => 'taken@example.com',
                'email_verified' => true,
            ]);
            $this->fail('Expected RuntimeException was not thrown.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('already linked', $e->getMessage());
        }

        $this->assertSame(
            'original-sub',
            User::query()->where('email', 'taken@example.com')->value('cognito_sub')
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function token(array $overrides = []): string
    {
        $now = time();
        $claims = array_merge([
            'sub' => 'cognito-sub',
            'email' => 'user@example.com',
            'iss' => 'https://cognito.example.com/pool',
            'aud' => 'client-id',
            'token_use' => 'id',
            'iat' => $now,
            'exp' => $now + 3600,
        ], $overrides);

        return JWT::encode($claims, $this->privateKey, 'RS256', 'test-key');
    }

    private function base64Url(string $binary): string
    {
        return rtrim(strtr(base64_encode($binary), '+/', '-_'), '=');
    }
}
