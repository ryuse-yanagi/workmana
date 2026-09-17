<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class StoreWorkspaceRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::WORKSPACE_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'status' => ['nullable', 'string', 'max:'.FieldLengthLimits::WORKSPACE_STATUS_NAME],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
        ];
    }
}
