<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/** 他の操作と重なり、このリクエストでは変更を確定できない。 */
class ConflictException extends Exception
{
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage() !== ''
                ? $this->getMessage()
                : '他の操作と重なったため、もう一度お試しください。',
        ], 409);
    }
}
