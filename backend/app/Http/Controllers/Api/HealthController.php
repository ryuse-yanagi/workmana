<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;

/**
 * ALB / ECS 向けの生存確認。認証・外部依存なしでアプリが応答できることだけを返す。
 */
class HealthController extends ApiController
{
    public function index(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }
}
