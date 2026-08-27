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

class LogoutClearsSessionTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
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
}
