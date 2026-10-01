<?php

namespace Tests\Unit\Support;

use Tests\TestCase;

class EcsRuntimeFilesTest extends TestCase
{
    /** nginx は Reverb の WebSocket 経路 /app をプロキシする */
    public function test_nginx_proxies_reverb_websocket_and_publish_paths(): void
    {
        $conf = (string) file_get_contents(base_path('nginx/default.conf'));

        $this->assertStringContainsString('location /app', $conf);
        $this->assertStringContainsString('location /apps', $conf);
        $this->assertStringContainsString('proxy_pass http://127.0.0.1:8080', $conf);
        $this->assertStringContainsString('error_log /dev/stderr', $conf);
        $this->assertStringContainsString('access_log /dev/stdout', $conf);
        $this->assertStringContainsString('proxy_set_header X-Forwarded-Proto $forwarded_proto', $conf);
        $this->assertStringContainsString('proxy_read_timeout 3600s', $conf);
        $this->assertStringContainsString('fastcgi_param HTTP_X_FORWARDED_PROTO $forwarded_proto', $conf);
        $this->assertStringContainsString('fastcgi_param HTTP_X_FORWARDED_PORT $http_x_forwarded_port', $conf);
    }

    /** コンテナは web / http / reverb の役割で起動できる */
    public function test_entrypoint_supports_ecs_runtimes(): void
    {
        $script = (string) file_get_contents(base_path('docker/entrypoint.sh'));

        $this->assertStringContainsString('APP_RUNTIME:-web', $script);
        $this->assertStringContainsString('reverb:start', $script);
        $this->assertStringContainsString('REVERB_BROADCAST_HOST', $script);
    }

    /** php-fpm は ECS の環境変数をワーカーへ渡し、ログを stderr へ出す */
    public function test_php_fpm_pool_ships_logs_and_env_to_workers(): void
    {
        $conf = (string) file_get_contents(base_path('docker/zz-cloudwatch.conf'));

        $this->assertStringContainsString('clear_env = no', $conf);
        $this->assertStringContainsString('catch_workers_output = yes', $conf);
        $this->assertStringContainsString('error_log] = /proc/self/fd/2', $conf);
    }
}
