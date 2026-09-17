<?php

namespace App\Http\Requests\Api;

use App\Support\BoardListColors;
use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class UpdateListRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::LIST_NAME],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'color_index' => ['sometimes', 'integer', 'min:0', 'max:'.(BoardListColors::STANDARD_COUNT - 1)],
        ];
    }
}
