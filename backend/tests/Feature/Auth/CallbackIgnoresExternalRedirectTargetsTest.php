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

class CallbackIgnoresExternalRedirectTargetsTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
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
}
