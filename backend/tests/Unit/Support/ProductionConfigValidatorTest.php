<?php

namespace Tests\Unit\Support;

use App\Support\ProductionConfigValidator;
use Tests\TestCase;

class ProductionConfigValidatorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->applyValidProductionConfig();
    }

    /** CloudWatch 向けの stderr ログと Reverb を含む本番設定はエラーにならない */
    public function test_valid_ecs_production_config_has_no_errors(): void
    {
        $this->assertSame([], ProductionConfigValidator::errors());
        $this->assertTrue(ProductionConfigValidator::writesLogsToStderr());
    }

    /** ファイルログは CloudWatch に乗らないため拒否する */
    public function test_file_log_channel_is_rejected(): void
    {
        config(['logging.default' => 'single']);

        $this->assertContains(
            'LOG_CHANNEL must be stderr or errorlog (or a stack that includes them) so ECS can ship logs to CloudWatch',
            ProductionConfigValidator::errors(),
        );
    }

    /** stack に stderr が含まれていれば許可する */
    public function test_stack_log_channel_is_allowed_when_it_includes_stderr(): void
    {
        config([
            'logging.default' => 'stack',
            'logging.channels.stack.channels' => ['stderr'],
        ]);

        $this->assertTrue(ProductionConfigValidator::writesLogsToStderr());
        $this->assertNotContains(
            'LOG_CHANNEL must be stderr or errorlog (or a stack that includes them) so ECS can ship logs to CloudWatch',
            ProductionConfigValidator::errors(),
        );
    }

    /** 本番のリアルタイム同期は Reverb 必須 */
    public function test_non_reverb_broadcast_connection_is_rejected(): void
    {
        config(['broadcasting.default' => 'null']);

        $this->assertContains(
            'BROADCAST_CONNECTION must be reverb',
            ProductionConfigValidator::errors(),
        );
    }

    /** クライアント向け Reverb ホストに localhost は使えない */
    public function test_localhost_reverb_host_is_rejected(): void
    {
        config(['reverb.servers.reverb.hostname' => '127.0.0.1']);

        $this->assertContains(
            'REVERB_HOST must be the public hostname clients use (not localhost)',
            ProductionConfigValidator::errors(),
        );
    }

    /** 本番の Reverb は HTTPS（WSS）必須 */
    public function test_non_https_reverb_scheme_is_rejected(): void
    {
        config(['reverb.apps.apps.0.options.scheme' => 'http']);

        $this->assertContains(
            'REVERB_SCHEME must be https',
            ProductionConfigValidator::errors(),
        );
    }

    /** Reverb 水平スケール時は Redis が必須 */
    public function test_reverb_scaling_without_redis_is_rejected(): void
    {
        config([
            'reverb.servers.reverb.scaling.enabled' => true,
            'reverb.servers.reverb.scaling.server.url' => '',
            'reverb.servers.reverb.scaling.server.host' => '127.0.0.1',
        ]);

        $this->assertContains(
            'REVERB_SCALING_ENABLED requires REDIS_URL or a non-localhost REDIS_HOST so Reverb nodes can share connections',
            ProductionConfigValidator::errors(),
        );
    }

    /** 本番の登録・招待は AdminCreateUser が必要なので User Pool ID を必須にする */
    public function test_missing_user_pool_id_is_rejected(): void
    {
        config(['cognito.user_pool_id' => '']);

        $this->assertContains(
            'COGNITO_USER_POOL_ID is required so registration and invite acceptance use AdminCreateUser',
            ProductionConfigValidator::errors(),
        );
    }

    /** コールバックがフロントホストだとログインセッションが届かない */
    public function test_callback_on_frontend_host_is_rejected(): void
    {
        config(['cognito.redirect_uri' => 'https://app.example.com/api/auth/callback']);

        $this->assertContains(
            'COGNITO_REDIRECT_URI host must match APP_URL so the Cognito callback hits this API',
            ProductionConfigValidator::errors(),
        );
    }

    /** フロントと API が別ホストなのに共有 Cookie ドメインがないと CSRF が読めない */
    public function test_split_hosts_without_session_domain_are_rejected(): void
    {
        config(['session.domain' => null]);

        $this->assertContains(
            'SESSION_DOMAIN must be the shared parent (for example .example.com) when the frontend and API hosts differ, so the SPA can read XSRF-TOKEN',
            ProductionConfigValidator::errors(),
        );
    }

    /** フロントと API が同一ホストなら SESSION_DOMAIN は不要 */
    public function test_same_host_frontend_and_api_do_not_require_session_domain(): void
    {
        config([
            'app.url' => 'https://app.example.com',
            'cognito.redirect_uri' => 'https://app.example.com/api/auth/callback',
            'cognito.frontend_url' => 'https://app.example.com',
            'session.domain' => null,
        ]);

        $this->assertSame([], ProductionConfigValidator::errors());
    }

    /** Reverb 水平スケール + リモート Redis は許可する */
    public function test_reverb_scaling_with_remote_redis_is_allowed(): void
    {
        config([
            'reverb.servers.reverb.scaling.enabled' => true,
            'reverb.servers.reverb.scaling.server.host' => 'reverb.cache.amazonaws.com',
        ]);

        $this->assertSame([], ProductionConfigValidator::errors());
    }

    private function applyValidProductionConfig(): void
    {
        config([
            'app.debug' => false,
            'app.url' => 'https://api.example.com',
            'session.encrypt' => true,
            'session.secure' => true,
            'session.http_only' => true,
            'session.same_site' => 'lax',
            'session.driver' => 'database',
            'cognito.bypass' => false,
            'cognito.jwks_url' => 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool/.well-known/jwks.json',
            'cognito.issuer' => 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool',
            'cognito.audience' => 'client-id',
            'cognito.domain' => 'https://example.auth.ap-northeast-1.amazoncognito.com',
            'cognito.client_id' => 'client-id',
            'cognito.user_pool_id' => 'ap-northeast-1_example',
            'cognito.redirect_uri' => 'https://api.example.com/api/auth/callback',
            'cognito.logout_redirect_uri' => 'https://app.example.com/login',
            'cognito.frontend_url' => 'https://app.example.com',
            'session.domain' => '.example.com',
            'cors.allowed_origins' => ['https://app.example.com'],
            'mail.default' => 'ses',
            'mail.from.address' => 'noreply@example.com',
            'services.ses.region' => 'ap-northeast-1',
            'filesystems.public_media' => 's3-public',
            'filesystems.private_media' => 's3-private',
            'filesystems.disks.s3-public.driver' => 's3',
            'filesystems.disks.s3-private.driver' => 's3',
            'filesystems.disks.s3-public.bucket' => 'work-manager',
            'logging.default' => 'stderr',
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.app_id' => 'app',
            'broadcasting.connections.reverb.key' => 'key',
            'broadcasting.connections.reverb.secret' => 'secret',
            'reverb.servers.reverb.hostname' => 'api.example.com',
            'reverb.servers.reverb.scaling.enabled' => false,
            'reverb.apps.apps.0.options.scheme' => 'https',
        ]);
    }
}
