<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrgRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_NAME],
            'slug' => [
                'sometimes',
                'nullable',
                'string',
                'max:'.FieldLengthLimits::ORGANIZATION_SLUG,
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('organizations', 'slug'),
            ],
        ];
    }
}
