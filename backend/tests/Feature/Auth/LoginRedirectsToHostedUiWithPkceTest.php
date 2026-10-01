<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Auth\Concerns\InteractsWithCognitoLogin;
use Tests\TestCase;

class LoginRedirectsToHostedUiWithPkceTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

    /** ログインはPKCE付きHosted UIへリダイレクトする */
    public function test_login_redirects_to_hosted_ui_with_pkce(): void
    {
        $response = $this->get('/api/auth/login?next=/org/acme/workspaces');

        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith('https://auth.example.com/oauth2/authorize?', $location);

        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        $this->assertSame('code', $query['response_type']);
        $this->assertSame('S256', $query['code_challenge_method']);
        $this->assertSame('login', $query['prompt']);
        $this->assertNotEmpty($query['state']);
        $this->assertNotEmpty($query['code_challenge']);
    }
}
