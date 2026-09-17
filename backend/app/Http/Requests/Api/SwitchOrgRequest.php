<?php

namespace App\Http\Requests\Api;

use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;

class SwitchOrgRequest extends FormRequest
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
            'organization_id' => ['required_without:slug', 'nullable', 'integer'],
            'slug' => ['required_without:organization_id', 'nullable', 'string', 'max:'.FieldLengthLimits::ORGANIZATION_SLUG],
        ];
    }
}
