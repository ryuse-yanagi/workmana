<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class StoreTaskLabelCatRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::LABEL_CATEGORY_NAME],
        ];
    }
}
