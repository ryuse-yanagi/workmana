<?php

namespace App\Http\Requests\Api;

use App\Support\BoardListColors;
use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class StoreListRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::LIST_NAME],
            'color_index' => ['required', 'integer', 'min:0', 'max:'.(BoardListColors::STANDARD_COUNT - 1)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
