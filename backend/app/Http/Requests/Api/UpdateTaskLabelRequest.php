<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use App\Support\LabelColorPresets;
use Illuminate\Foundation\Http\FormRequest;

class UpdateTaskLabelRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::LABEL_NAME],
            'color_index' => ['sometimes', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
