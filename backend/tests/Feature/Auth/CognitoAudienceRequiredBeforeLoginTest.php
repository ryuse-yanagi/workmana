<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
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

    /** ログイン前にCognito audienceの設定が必須 */
    public function test_cognito_audience_is_required_before_login(): void
    {
        config(['cognito.audience' => '']);

        $this->get('/api/auth/login')
            ->assertRedirect('http://localhost:3000/login?error=cognito_not_configured');
    }
}
