<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskLabelCatRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::LABEL_CATEGORY_NAME],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
