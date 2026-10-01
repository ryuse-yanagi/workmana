<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Auth\Concerns\InteractsWithCognitoLogin;
use Tests\TestCase;

class SessionReportsUnauthenticatedTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

    /** 未認証でもセッションエンドポイントは失敗せず返す */
    public function test_session_endpoint_reports_unauthenticated_without_failing(): void
    {
        $this->getJson('/api/auth/session')
            ->assertOk()
            ->assertJson([
                'authenticated' => false,
                'configured' => true,
                'user' => null,
            ]);
    }
}
