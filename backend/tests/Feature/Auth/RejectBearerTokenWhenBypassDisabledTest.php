<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    /** バイパス無効時はBearerトークンが拒否される */
    public function test_api_rejects_bearer_token_when_bypass_is_disabled(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Authorization', 'Bearer '.$user->id)
            ->getJson('/api/me')
            ->assertStatus(401);
    }
}
