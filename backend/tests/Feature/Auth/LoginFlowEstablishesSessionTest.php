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

class LoginFlowEstablishesSessionTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
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
}
