<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
            'email' => ['required', 'string', 'email', 'max:'.FieldLengthLimits::EMAIL],
            'password' => ['required', 'string', 'min:8', 'max:'.FieldLengthLimits::PASSWORD],
        ];
    }
}
