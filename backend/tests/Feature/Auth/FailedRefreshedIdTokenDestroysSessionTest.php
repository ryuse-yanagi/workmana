<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Services\CognitoJwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Session\EncryptedStore;
use Illuminate\Support\Facades\Http;
use Mockery;
use RuntimeException;
use Tests\Feature\Auth\Concerns\InteractsWithCognitoLogin;
use Tests\TestCase;

class FailedRefreshedIdTokenDestroysSessionTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
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
}
