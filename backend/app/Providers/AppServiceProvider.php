<?php

namespace App\Providers;

use App\Filesystem\S3AclFreeDisk;
use App\Support\FieldLengthLimits;
use App\Support\LabelColorPresets;
use App\Support\ProductionConfigValidator;
use App\Support\Workspace\BoardListColors;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        S3AclFreeDisk::register(Storage::getFacadeRoot());
        $this->validateProductionSecurityConfiguration();
        $this->assertSharedContractsInNonProduction();

        RateLimiter::for('invites', function (Request $request) {
            return Limit::perMinute(20)->by($request->ip());
        });
    }

    /**
     * FE/BE 共有 JSON と PHP 定数の食い違いを非 production で早期検出する。
     */
    private function assertSharedContractsInNonProduction(): void
    {
        if ($this->app->environment('production')) {
            return;
        }

        FieldLengthLimits::assertMatchesSharedJson();
        LabelColorPresets::assertMatchesSharedJson();
        BoardListColors::assertMatchesSharedJson();
    }

    /**
     * 本番環境を危険な認証・メール・ログ・リアルタイム設定のまま起動させない。
     */
    private function validateProductionSecurityConfiguration(): void
    {
        if (! $this->app->environment('production')) {
            return;
        }

        $errors = ProductionConfigValidator::errors();

        if ($errors !== []) {
            throw new RuntimeException(
                "Unsafe production configuration:\n- ".implode("\n- ", $errors)
            );
        }
    }
}
