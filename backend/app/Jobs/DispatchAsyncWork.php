<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * メール・通知・重い処理などを SQS 経由で非同期に扱うためのジョブ雛形。
 * キュー接続を database から sqs に切り替えれば設計書の SQS 構成に沿って動作する。
 */
class DispatchAsyncWork implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $kind,
        public array $payload = []
    ) {}

    public function handle(): void
    {
        Log::info('async_work', [
            'kind' => $this->kind,
            'payload' => $this->payload,
        ]);
    }
}
