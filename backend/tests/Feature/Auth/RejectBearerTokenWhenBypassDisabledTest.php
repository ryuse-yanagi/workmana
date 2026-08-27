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

class RejectBearerTokenWhenBypassDisabledTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

    public function test_api_rejects_bearer_token_when_bypass_is_disabled(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/me')
            ->assertStatus(401);
    }
}
