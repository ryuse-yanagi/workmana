<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Auth\Concerns\InteractsWithCognitoLogin;
use Tests\TestCase;

class RejectUnauthenticatedApiRequestsTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

    /** セッションCookieなしのAPIリクエストは拒否される */
    public function test_api_rejects_requests_without_session_cookie(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }
}
