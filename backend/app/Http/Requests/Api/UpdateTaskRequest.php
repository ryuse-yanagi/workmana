<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use App\Support\TaskPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'max:'.FieldLengthLimits::TASK_TITLE],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'list_id' => ['sometimes', 'integer', 'exists:lists,id'],
            'priority' => ['sometimes', 'string', Rule::in(TaskPriority::values())],
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
            'checklists' => ['sometimes', 'array'],
            'checklists.*.id' => ['sometimes', 'integer', 'distinct'],
            'checklists.*.title' => ['required', 'string', 'max:'.FieldLengthLimits::CHECKLIST_TITLE],
            'checklists.*.items' => ['sometimes', 'array'],
            'checklists.*.items.*.id' => ['required', 'uuid'],
            'checklists.*.items.*.text' => ['required', 'string', 'max:'.FieldLengthLimits::CHECKLIST_ITEM_TEXT],
            'checklists.*.items.*.checked' => ['required', 'boolean'],
        ];
    }
}
