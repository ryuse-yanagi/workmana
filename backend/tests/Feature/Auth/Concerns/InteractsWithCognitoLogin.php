<?php

namespace Tests\Feature\Auth\Concerns;

use App\Models\User;
use App\Services\CognitoJwtService;
use Illuminate\Support\Facades\Http;
use Mockery;

trait InteractsWithCognitoLogin
{
    protected function configureCognitoForTests(): void
    {
        config([
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

    protected function startLogin(string $next): string
    {
        $response = $this->get('/api/auth/login?next='.urlencode($next));

        parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

        return (string) $query['state'];
    }

    protected function fakeTokenEndpoint(): void
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

    protected function mockJwtService(User $user): void
    {
        $jwt = Mockery::mock(CognitoJwtService::class);
        $jwt->shouldReceive('verifyAndDecode')->with('id-token')->andReturn(['sub' => 'cognito-sub']);
        $jwt->shouldReceive('syncUserFromClaims')->andReturn($user);
        $jwt->shouldReceive('resolveBypassUser')->andReturn(null);

        $this->instance(CognitoJwtService::class, $jwt);
    }
}
