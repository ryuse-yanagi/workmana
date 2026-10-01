<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use App\Support\Task\TaskPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    /** 認可はコントローラ側で行う。 */
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
            'title' => ['required', 'string', 'max:'.FieldLengthLimits::TASK_TITLE],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'list_id' => ['required', 'integer', 'exists:lists,id'],
            'priority' => ['nullable', 'string', Rule::in(TaskPriority::values())],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'gantt_bar_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'effort_hours' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'progress_rate' => ['nullable', 'integer', 'min:0', 'max:100'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'is_parent_task' => ['sometimes', 'boolean'],
            'parent_task_id' => ['sometimes', 'nullable', 'integer'],
        ];
    }
}
