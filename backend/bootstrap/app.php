<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

/**
 * Cookie ベースの認証を成立させるため、API ルートでもセッションと CSRF 検証を有効にする。
 * 並び順（Cookie 復号 → キュー済み Cookie → セッション開始 → CSRF 検証）は変更しないこと。
 *
 * @var list<class-string>
 */
$statefulApi = [
    \Illuminate\Cookie\Middleware\EncryptCookies::class,
    \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
    \Illuminate\Session\Middleware\StartSession::class,
    \Illuminate\Foundation\Http\Middleware\PreventRequestForgery::class,
];

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        [
            'prefix' => 'api',
            'middleware' => [...$statefulApi, 'cognito'],
        ],
    )
    ->withMiddleware(function (Middleware $middleware) use ($statefulApi): void {
        // ALB が HTTPS を終端する。転送ヘッダーを信じないと、コンテナ内は常に HTTP になる。
        $middleware->trustProxies(at: '*');

        $middleware->api(prepend: $statefulApi);

        $middleware->alias([
            'cognito' => \App\Http\Middleware\AuthenticateCognito::class,
            'org.member' => \App\Http\Middleware\EnsureOrganizationMember::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
