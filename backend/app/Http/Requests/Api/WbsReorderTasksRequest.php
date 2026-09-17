<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class WbsReorderTasksRequest extends FormRequest
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
            'tasks' => ['required', 'array', 'min:1'],
            'tasks.*.id' => ['required', 'integer', 'distinct'],
            'tasks.*.sort_order' => ['required', 'integer', 'min:0'],
            'tasks.*.parent_task_id' => ['nullable', 'integer'],
        ];
    }
}
