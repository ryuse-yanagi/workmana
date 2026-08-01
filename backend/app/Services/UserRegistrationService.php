<?php

namespace App\Services;

use App\Models\OrganizationInvite;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * 組織に紐付かないセルフサーブのアカウント作成。
 * 組織作成は別 API（POST /organizations）で行う。
 */
class UserRegistrationService
{
    public function __construct(
        private readonly CognitoUserRegistrationService $cognitoRegistration,
    ) {}

    public function register(string $name, string $email, string $password): User
    {
        $name = trim($name);
        $email = OrganizationInvite::normalizeEmail($email);

        if ($name === '') {
            throw new RuntimeException('名前を入力してください。');
        }
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('メールアドレスの形式が正しくありません。');
        }
        if (mb_strlen($password) < 8) {
            throw new RuntimeException('パスワードは8文字以上にしてください。');
        }

        $existing = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        if ($existing !== null && $existing->cognito_sub !== null && $existing->cognito_sub !== '') {
            throw new RuntimeException('このメールアドレスは既に登録されています。');
        }

        return DB::transaction(function () use ($existing, $name, $email, $password) {
            $sub = $this->cognitoRegistration->register($email, $password, $name);

            if ($existing !== null) {
                $existing->name = $name;
                $existing->password = $password;
                $existing->cognito_sub = $sub;
                if ($existing->email_verified_at === null) {
                    $existing->email_verified_at = now();
                }
                $existing->save();

                return $existing->fresh();
            }

            return User::query()->create([
                'email' => $email,
                'name' => $name,
                'password' => $password,
                'cognito_sub' => $sub,
                'email_verified_at' => now(),
            ]);
        });
    }
}
