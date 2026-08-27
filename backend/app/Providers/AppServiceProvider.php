<?php

namespace App\Providers;

use App\Models\Task;
use App\Observers\TaskObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->validateProductionSecurityConfiguration();
        Task::observe(TaskObserver::class);

        RateLimiter::for('invites', function (Request $request) {
            return Limit::perMinute(20)->by($request->ip());
        });
    }

    /**
     * 本番環境を危険な認証・メール設定のまま起動させない。
     */
    private function validateProductionSecurityConfiguration(): void
    {
        if (! $this->app->environment('production')) {
            return;
        }

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

        if ($errors !== []) {
            throw new RuntimeException(
                "Unsafe production configuration:\n- ".implode("\n- ", $errors)
            );
        }
    }
}
