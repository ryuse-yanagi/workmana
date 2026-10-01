<?php

namespace App\Support;

/**
 * 本番起動時に危険な認証・メール・ログ・リアルタイム設定を検出する。
 */
final class ProductionConfigValidator
{
    /**
     * @return list<string>
     */
    public static function errors(): array
    {
        $errors = [];

        if (config('app.debug')) {
            $errors[] = 'APP_DEBUG must be false';
        }
        if (! config('session.encrypt')) {
            $errors[] = 'SESSION_ENCRYPT must be true';
        }
        if (! config('session.secure')) {
            $errors[] = 'SESSION_SECURE_COOKIE must be true';
        }
        if (! config('session.http_only')) {
            $errors[] = 'SESSION_HTTP_ONLY must be true';
        }

        $sameSite = strtolower((string) config('session.same_site', ''));
        if (! in_array($sameSite, ['lax', 'none'], true)) {
            $errors[] = 'SESSION_SAME_SITE must be lax or none (strict breaks the Cognito callback)';
        }

        if (in_array(config('session.driver'), ['array', 'cookie'], true)) {
            $errors[] = 'SESSION_DRIVER must use server-side storage (database, Redis, file, etc.)';
        }
        if (config('cognito.bypass')) {
            $errors[] = 'COGNITO_BYPASS must be false';
        }

        foreach ([
            'COGNITO_JWKS_URL' => config('cognito.jwks_url'),
            'COGNITO_ISSUER' => config('cognito.issuer'),
            'COGNITO_AUDIENCE' => config('cognito.audience'),
            'COGNITO_DOMAIN' => config('cognito.domain'),
            'COGNITO_CLIENT_ID' => config('cognito.client_id'),
            'COGNITO_REDIRECT_URI' => config('cognito.redirect_uri'),
            'COGNITO_LOGOUT_REDIRECT_URI' => config('cognito.logout_redirect_uri'),
            'COGNITO_FRONTEND_URL' => config('cognito.frontend_url'),
        ] as $name => $value) {
            if (! is_string($value) || $value === '') {
                $errors[] = $name.' is required';
            }
        }

        if ((string) config('cognito.audience') !== (string) config('cognito.client_id')) {
            $errors[] = 'COGNITO_AUDIENCE must match COGNITO_CLIENT_ID for Cognito ID tokens';
        }

        if (trim((string) (config('cognito.user_pool_id') ?? '')) === '') {
            $errors[] = 'COGNITO_USER_POOL_ID is required so registration and invite acceptance use AdminCreateUser';
        }

        $errors = array_merge($errors, self::cognitoCallbackErrors(), self::splitHostSessionErrors());

        foreach ([
            'APP_URL' => config('app.url'),
            'COGNITO_JWKS_URL' => config('cognito.jwks_url'),
            'COGNITO_ISSUER' => config('cognito.issuer'),
            'COGNITO_DOMAIN' => config('cognito.domain'),
            'COGNITO_REDIRECT_URI' => config('cognito.redirect_uri'),
            'COGNITO_LOGOUT_REDIRECT_URI' => config('cognito.logout_redirect_uri'),
            'COGNITO_FRONTEND_URL' => config('cognito.frontend_url'),
        ] as $name => $url) {
            if (is_string($url) && $url !== '' && parse_url($url, PHP_URL_SCHEME) !== 'https') {
                $errors[] = $name.' must use HTTPS';
            }
        }

        $allowedOrigins = (array) config('cors.allowed_origins', []);
        if ($allowedOrigins === []) {
            $errors[] = 'CORS_ALLOWED_ORIGINS must contain the HTTPS frontend origin';
        }
        foreach ($allowedOrigins as $origin) {
            if (! is_string($origin) || parse_url($origin, PHP_URL_SCHEME) !== 'https') {
                $errors[] = 'Every CORS_ALLOWED_ORIGINS entry must use HTTPS';
                break;
            }
        }

        $mailer = (string) config('mail.default', '');
        if (! in_array($mailer, ['ses', 'ses-v2'], true)) {
            $errors[] = 'MAIL_MAILER must be ses or ses-v2 (organization invites are sent via Amazon SES)';
        }

        $fromAddress = (string) config('mail.from.address', '');
        if ($fromAddress === '' || strcasecmp($fromAddress, 'hello@example.com') === 0) {
            $errors[] = 'MAIL_FROM_ADDRESS must be a SES-verified sender address (not the Laravel placeholder)';
        }

        $awsRegion = (string) config('services.ses.region', '');
        if ($awsRegion === '') {
            $errors[] = 'AWS_DEFAULT_REGION is required for Amazon SES';
        }

        $publicMediaDriver = (string) config('filesystems.disks.'.config('filesystems.public_media').'.driver', '');
        $privateMediaDriver = (string) config('filesystems.disks.'.config('filesystems.private_media').'.driver', '');
        if ($publicMediaDriver !== 's3' || $privateMediaDriver !== 's3') {
            $errors[] = 'FILESYSTEM_DISK must be s3 (avatars, organization icons, and task attachments are stored on Amazon S3)';
        }

        $publicBucket = (string) (config('filesystems.disks.'.config('filesystems.public_media').'.bucket') ?? '');
        $privateBucket = (string) (config('filesystems.disks.'.config('filesystems.private_media').'.bucket') ?? '');
        if ($publicBucket === '' || $privateBucket === '') {
            $errors[] = 'AWS_BUCKET is required for Amazon S3 media storage';
        }

        if (! self::writesLogsToStderr()) {
            $errors[] = 'LOG_CHANNEL must be stderr or errorlog (or a stack that includes them) so ECS can ship logs to CloudWatch';
        }

        if ((string) config('broadcasting.default') !== 'reverb') {
            $errors[] = 'BROADCAST_CONNECTION must be reverb';
        }

        foreach ([
            'REVERB_APP_ID' => config('broadcasting.connections.reverb.app_id'),
            'REVERB_APP_KEY' => config('broadcasting.connections.reverb.key'),
            'REVERB_APP_SECRET' => config('broadcasting.connections.reverb.secret'),
            'REVERB_HOST' => config('reverb.servers.reverb.hostname'),
        ] as $name => $value) {
            if (! is_string($value) || $value === '') {
                $errors[] = $name.' is required';
            }
        }

        $reverbHost = strtolower((string) config('reverb.servers.reverb.hostname', ''));
        if (in_array($reverbHost, ['127.0.0.1', 'localhost', '0.0.0.0'], true)) {
            $errors[] = 'REVERB_HOST must be the public hostname clients use (not localhost)';
        }

        $reverbScheme = strtolower((string) config('reverb.apps.apps.0.options.scheme', ''));
        if ($reverbScheme !== 'https') {
            $errors[] = 'REVERB_SCHEME must be https';
        }

        if (config('reverb.servers.reverb.scaling.enabled')) {
            $redisUrl = (string) config('reverb.servers.reverb.scaling.server.url', '');
            $redisHost = (string) config('reverb.servers.reverb.scaling.server.host', '');
            if ($redisUrl === '' && ($redisHost === '' || in_array($redisHost, ['127.0.0.1', 'localhost'], true))) {
                $errors[] = 'REVERB_SCALING_ENABLED requires REDIS_URL or a non-localhost REDIS_HOST so Reverb nodes can share connections';
            }
        }

        return $errors;
    }

    /**
     * コールバックが別ホストだと PKCE の state が届かないため、ホストとパスが API と一致することを検証する。
     *
     * @return list<string>
     */
    private static function cognitoCallbackErrors(): array
    {
        $redirectUri = (string) config('cognito.redirect_uri');
        $apiHost = parse_url((string) config('app.url'), PHP_URL_HOST);
        $redirectHost = parse_url($redirectUri, PHP_URL_HOST);
        $redirectPath = parse_url($redirectUri, PHP_URL_PATH);
        $errors = [];

        if (! is_string($apiHost) || $apiHost === '' || ! is_string($redirectHost) || strcasecmp($apiHost, $redirectHost) !== 0) {
            $errors[] = 'COGNITO_REDIRECT_URI host must match APP_URL so the Cognito callback hits this API';
        }

        $path = is_string($redirectPath) ? rtrim($redirectPath, '/') : '';
        if ($path !== '/api/auth/callback') {
            $errors[] = 'COGNITO_REDIRECT_URI path must be /api/auth/callback';
        }

        return $errors;
    }

    /**
     * フロントと API が別ホストのとき、両方が SESSION_DOMAIN の配下であることを検証する。
     *
     * @return list<string>
     */
    private static function splitHostSessionErrors(): array
    {
        $apiHost = parse_url((string) config('app.url'), PHP_URL_HOST);
        $frontendHost = parse_url((string) config('cognito.frontend_url'), PHP_URL_HOST);
        if (! is_string($apiHost) || $apiHost === '' || ! is_string($frontendHost) || $frontendHost === '') {
            return [];
        }

        if (strcasecmp($apiHost, $frontendHost) === 0) {
            return [];
        }

        $sessionDomain = trim((string) (config('session.domain') ?? ''));
        if ($sessionDomain === '') {
            return ['SESSION_DOMAIN must be the shared parent (for example .example.com) when the frontend and API hosts differ, so the SPA can read XSRF-TOKEN'];
        }

        if (! self::hostIsUnderDomain($apiHost, $sessionDomain) || ! self::hostIsUnderDomain($frontendHost, $sessionDomain)) {
            return ['SESSION_DOMAIN must cover both APP_URL and COGNITO_FRONTEND_URL'];
        }

        return [];
    }

    private static function hostIsUnderDomain(string $host, string $domain): bool
    {
        $host = strtolower($host);
        $domain = strtolower(ltrim($domain, '.'));
        if ($domain === '') {
            return false;
        }

        return $host === $domain || str_ends_with($host, '.'.$domain);
    }

    /** 既定チャネルが stderr か errorlog、またはそれらを含む stack なら真。 */
    public static function writesLogsToStderr(): bool
    {
        $channel = (string) config('logging.default', '');
        if (in_array($channel, ['stderr', 'errorlog'], true)) {
            return true;
        }

        if ($channel !== 'stack') {
            return false;
        }

        $stacked = config('logging.channels.stack.channels', []);
        if (! is_array($stacked)) {
            return false;
        }

        foreach ($stacked as $name) {
            if (is_string($name) && in_array($name, ['stderr', 'errorlog'], true)) {
                return true;
            }
        }

        return false;
    }
}
