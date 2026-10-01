<?php

namespace Tests\Feature\Health;

use Tests\TestCase;

class ApplicationHealthTest extends TestCase
{
    /** Laravel のヘルスチェック /up が 200 を返す */
    public function test_the_application_health_endpoint_returns_ok(): void
    {
        $this->get('/up')->assertOk();
    }

    /** ALB が付けた X-Forwarded-Proto を HTTPS として扱う */
    public function test_forwarded_https_from_the_load_balancer_is_secure(): void
    {
        $this->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Port' => '443',
        ])->get('/up')->assertOk();

        $this->assertTrue(request()->isSecure());
        $this->assertSame(443, request()->getPort());
    }
}
