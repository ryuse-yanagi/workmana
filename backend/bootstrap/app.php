<?php

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

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
        // 同時操作の外部キー違反やデッドロックは、500 ではなくやり直し可能な応答にする。
        $exceptions->render(function (QueryException $e, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            $state = (string) ($e->errorInfo[0] ?? $e->getCode());
            $message = match ($state) {
                '40P01', '40001' => '他の操作と重なったため、もう一度お試しください。',
                '23503', '23505' => '他の操作と重なったため、保存できませんでした。画面を更新してもう一度お試しください。',
                default => null,
            };
            if ($message === null) {
                return null;
            }

            return response()->json(['message' => $message], 409);
        });
    })->create();
