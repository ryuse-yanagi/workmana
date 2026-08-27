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

class CognitoAudienceRequiredBeforeLoginTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

    public function test_cognito_audience_is_required_before_login(): void
    {
        config(['cognito.audience' => '']);

        $this->get('/api/auth/login')
            ->assertRedirect('http://localhost:3000/login?error=cognito_not_configured');
    }
}
