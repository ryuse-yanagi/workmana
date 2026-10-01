<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Session\EncryptedStore;
use Tests\Feature\Auth\Concerns\InteractsWithCognitoLogin;
use Tests\TestCase;

class ServerSideSessionPayloadIsEncryptedTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

    /** サーバー側セッションのペイロードは暗号化される */
    public function test_server_side_session_payload_is_encrypted(): void
    {
        $this->get('/api/auth/session')->assertOk();

        $this->assertTrue((bool) config('session.encrypt'));
        $this->assertInstanceOf(EncryptedStore::class, app('session')->driver());
    }
}
