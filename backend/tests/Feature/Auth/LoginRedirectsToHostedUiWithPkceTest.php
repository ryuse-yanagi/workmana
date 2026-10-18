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
        $this->assertArrayNotHasKey('login_hint', $query);
    }

    /** 招待先メールは Hosted UI の入力欄へ渡す */
    public function test_login_hint_is_forwarded_when_it_is_an_email(): void
    {
        $response = $this->get('/api/auth/login?next='.urlencode('/invite/token').'&login_hint='.urlencode('Invitee@Example.com'));

        parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

        $this->assertSame('invitee@example.com', $query['login_hint']);
    }

    /** メールでない login_hint は認可 URL に載せない */
    public function test_invalid_login_hint_is_omitted(): void
    {
        $response = $this->get('/api/auth/login?login_hint='.urlencode('not an email'));

        parse_str((string) parse_url((string) $response->headers->get('Location'), PHP_URL_QUERY), $query);

        $this->assertArrayNotHasKey('login_hint', $query);
    }
}
