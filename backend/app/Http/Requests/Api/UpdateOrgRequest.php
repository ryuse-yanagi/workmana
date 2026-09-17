<?php

namespace App\Http\Requests\Api;

use App\Support\DefaultBoardLists;
use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class UpdateOrgRequest extends FormRequest
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
        $maxItems = DefaultBoardLists::maxItems();

        return [
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_NAME],
            'default_board_list_names' => ['sometimes', 'array', 'max:'.$maxItems],
            'default_board_list_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::LIST_NAME],
            'default_workspace_status_names' => ['sometimes', 'array', 'max:'.$maxItems],
            'default_workspace_status_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::WORKSPACE_STATUS_NAME],
            'default_document_category_names' => ['sometimes', 'array', 'max:'.$maxItems],
            'default_document_category_names.*.name' => ['required', 'string', 'max:'.FieldLengthLimits::DOCUMENT_CATEGORY_NAME],
        ];
    }
}
