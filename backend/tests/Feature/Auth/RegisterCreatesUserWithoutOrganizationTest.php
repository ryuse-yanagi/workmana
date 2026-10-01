<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterCreatesUserWithoutOrganizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cognito.bypass_user_id' => null]);
    }

    /** 登録で組織なしのユーザーが作成される */
    public function test_register_creates_user_without_organization(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => '新規太郎',
            'email' => 'New.User@Example.com',
            'password' => 'password123',
        ])
            ->assertCreated()
            ->assertJsonPath('user.email', 'new.user@example.com')
            ->assertJsonPath('user.name', '新規太郎');

        $user = User::query()->where('email', 'new.user@example.com')->first();
        $this->assertNotNull($user);
        $this->assertNotNull($user->cognito_sub);
        $this->assertSame(0, $user->organizations()->count());
        $this->assertNull($user->last_organization_id);
    }

    /** 重複メールでの登録は拒否される */
    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create([
            'email' => 'dup@example.com',
            'cognito_sub' => 'existing-sub',
        ]);

        $this->postJson('/api/auth/register', [
            'name' => '重複',
            'email' => 'dup@example.com',
            'password' => 'password123',
        ])
            ->assertStatus(422);
    }
}
