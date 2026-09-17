<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSharedDocRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::DOCUMENT_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'body' => ['nullable', 'string', 'max:'.FieldLengthLimits::DOCUMENT_BODY],
            'category' => ['sometimes', 'nullable', 'string', 'max:'.FieldLengthLimits::DOCUMENT_CATEGORY_NAME],
        ];
    }
}
