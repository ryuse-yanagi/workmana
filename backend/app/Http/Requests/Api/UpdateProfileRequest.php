<?php

namespace App\Http\Requests\Api;

use App\Models\OrganizationInvite;
use App\Models\User;
use App\Support\FieldLengthLimits;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => OrganizationInvite::normalizeEmail((string) $this->input('email', '')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::USER_NAME],
            'email' => [
                'required',
                'string',
                'email',
                'max:'.FieldLengthLimits::EMAIL,
                Rule::unique(User::class, 'email')->ignore($this->user()->id),
            ],
        ];
    }
}
