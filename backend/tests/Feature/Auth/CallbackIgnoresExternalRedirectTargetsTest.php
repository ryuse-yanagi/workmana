<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    /** コールバックは外部リダイレクト先を無視する */
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
