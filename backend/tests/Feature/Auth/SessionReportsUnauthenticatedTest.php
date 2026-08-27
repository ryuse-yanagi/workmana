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

class SessionReportsUnauthenticatedTest extends TestCase
{
    use InteractsWithCognitoLogin;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureCognitoForTests();
    }

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
