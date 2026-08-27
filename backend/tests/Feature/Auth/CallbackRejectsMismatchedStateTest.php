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

class CallbackRejectsMismatchedStateTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
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
}
