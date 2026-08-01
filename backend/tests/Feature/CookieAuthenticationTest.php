<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CognitoJwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Session\EncryptedStore;
use Illuminate\Support\Facades\Http;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class CookieAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            // 本番同様、ローカル用バイパスは無効にして検証する
            'cognito.bypass' => false,
            'cognito.domain' => 'https://auth.example.com',
            'cognito.client_id' => 'client-id',
            'cognito.client_secret' => '',
            'cognito.redirect_uri' => 'http://localhost:3000/api/auth/callback',
            'cognito.logout_redirect_uri' => 'http://localhost:3000/login',
            'cognito.jwks_url' => 'https://cognito.example.com/.well-known/jwks.json',
            'cognito.issuer' => 'https://cognito.example.com/pool',
            'cognito.audience' => 'client-id',
            'cognito.frontend_url' => 'http://localhost:3000',
            'cognito.default_redirect_path' => '/org/acme/workspaces',
        ]);
    }

    public function test_api_rejects_requests_without_session_cookie(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_api_rejects_bearer_token_when_bypass_is_disabled(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/me')
            ->assertStatus(401);
    }

    public function test_session_endpoint_reports_unauthenticated_without_failing(): void
    {
        $this->getJson('/api/auth/session')
            ->assertOk()
            ->assertJson([
                'authenticated' => false,
                'configured' => true,
                'user' => null,
            ]);
    }

    public function test_cognito_audience_is_required_before_login(): void
    {
        config(['cognito.audience' => '']);

        $this->get('/api/auth/login')
            ->assertRedirect('http://localhost:3000/login?error=cognito_not_configured');
    }

    public function test_server_side_session_payload_is_encrypted(): void
    {
        $this->get('/api/auth/session')->assertOk();

        $this->assertTrue((bool) config('session.encrypt'));
        $this->assertInstanceOf(EncryptedStore::class, app('session')->driver());
    }

    public function test_login_redirects_to_hosted_ui_with_pkce(): void
    {
        $response = $this->get('/api/auth/login?next=/org/acme/workspaces');

        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith('https://auth.example.com/oauth2/authorize?', $location);

        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        $this->assertSame('code', $query['response_type']);
        $this->assertSame('S256', $query['code_challenge_method']);
        $this->assertNotEmpty($query['state']);
        $this->assertNotEmpty($query['code_challenge']);
    }

    public function test_login_flow_establishes_session_and_keeps_tokens_server_side(): void
    {
        $user = User::factory()->create();
        $this->fakeTokenEndpoint();
        $this->mockJwtService($user);

        $state = $this->startLogin('/org/acme/workspaces');

        $callback = $this->get('/api/auth/callback?code=auth-code&state='.$state);
        $callback->assertRedirect('http://localhost:3000/org/acme/workspaces');

        // トークンはレスポンスに一切現れない
        $this->assertStringNotContainsString('id-token', $callback->getContent());
        $this->assertStringNotContainsString('refresh-token', $callback->getContent());

        // 以降はセッション Cookie だけで認証できる
        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonMissingPath('id_token');
    }

    public function test_callback_rejects_mismatched_state(): void
    {
        $this->fakeTokenEndpoint();
        $this->startLogin('/org/acme/workspaces');

        $this->get('/api/auth/callback?code=auth-code&state=forged-state')
            ->assertRedirect('http://localhost:3000/login?error=state_mismatch');

        Http::assertNothingSent();
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_callback_ignores_external_redirect_targets(): void
    {
        $user = User::factory()->create();
        $this->fakeTokenEndpoint();
        $this->mockJwtService($user);

        $state = $this->startLogin('//evil.example.com/steal');

        $this->get('/api/auth/callback?code=auth-code&state='.$state)
            ->assertRedirect('http://localhost:3000/org/acme/workspaces');
    }

    public function test_logout_clears_session(): void
    {
        $user = User::factory()->create();
        $this->fakeTokenEndpoint();
        $this->mockJwtService($user);

        $state = $this->startLogin('/org/acme/workspaces');
        $this->get('/api/auth/callback?code=auth-code&state='.$state);
        $this->getJson('/api/me')->assertOk();

        $this->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('logout_url', 'https://auth.example.com/logout?client_id=client-id&logout_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin');

        Http::assertSent(fn ($request) => $request->url() === 'https://auth.example.com/oauth2/revoke'
            && $request['token'] === 'refresh-token'
            && $request['client_id'] === 'client-id');

        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_failed_validation_of_refreshed_id_token_destroys_session(): void
    {
        $user = User::factory()->create(['cognito_sub' => 'cognito-sub']);

        Http::fake(function ($request) {
            if ($request->url() !== 'https://auth.example.com/oauth2/token') {
                return Http::response([], 404);
            }

            if ($request['grant_type'] === 'refresh_token') {
                return Http::response([
                    'access_token' => 'refreshed-access-token',
                    'id_token' => 'invalid-refreshed-id-token',
                    'expires_in' => 3600,
                ]);
            }

            return Http::response([
                'access_token' => 'access-token',
                'id_token' => 'id-token',
                'refresh_token' => 'refresh-token',
                'expires_in' => 0,
            ]);
        });

        $jwt = Mockery::mock(CognitoJwtService::class);
        $jwt->shouldReceive('verifyAndDecode')
            ->once()
            ->with('id-token')
            ->andReturn(['sub' => 'cognito-sub']);
        $jwt->shouldReceive('syncUserFromClaims')->once()->andReturn($user);
        $jwt->shouldReceive('verifyAndDecode')
            ->once()
            ->with('invalid-refreshed-id-token')
            ->andThrow(new RuntimeException('invalid refreshed token'));
        $jwt->shouldReceive('resolveBypassUser')->andReturn(null);
        $this->instance(CognitoJwtService::class, $jwt);

        $state = $this->startLogin('/org/acme/workspaces');
        $this->get('/api/auth/callback?code=auth-code&state='.$state);

        $this->getJson('/api/me')->assertStatus(401);
        $this->getJson('/api/me')->assertStatus(401);
    }

    /**
     * 認可リクエストを開始し、発行された state を返す。
     */
    private function startLogin(string $next): string
    {
        $response = $this->get('/api/auth/login?next='.urlencode($next));

        parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

        return (string) $query['state'];
    }

    private function fakeTokenEndpoint(): void
    {
        Http::fake([
            'auth.example.com/oauth2/token' => Http::response([
                'access_token' => 'access-token',
                'id_token' => 'id-token',
                'refresh_token' => 'refresh-token',
                'expires_in' => 3600,
            ]),
        ]);
    }

    private function mockJwtService(User $user): void
    {
        $jwt = Mockery::mock(CognitoJwtService::class);
        $jwt->shouldReceive('verifyAndDecode')->with('id-token')->andReturn(['sub' => 'cognito-sub']);
        $jwt->shouldReceive('syncUserFromClaims')->andReturn($user);
        $jwt->shouldReceive('resolveBypassUser')->andReturn(null);

        $this->instance(CognitoJwtService::class, $jwt);
    }
}
