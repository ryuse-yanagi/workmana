<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use App\Support\LabelColorPresets;
use Illuminate\Foundation\Http\FormRequest;

class StoreTaskLabelRequest extends FormRequest
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
            'category_id' => ['required', 'integer', 'exists:task_label_categories,id'],
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::LABEL_NAME],
            'color_index' => ['nullable', 'integer', 'min:0', 'max:'.(LabelColorPresets::COUNT - 1)],
        ];
    }
}
