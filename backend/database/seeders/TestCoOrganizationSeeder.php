<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestCoOrganizationSeeder extends Seeder
{
    /**
     * slug = test-co の組織と、local 用テストユーザーの membership を投入する（冪等）。
     */
    public function run (): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
            ],
        );

        $org = Organization::query()->firstOrCreate(
            ['slug' => 'test-co'],
            [
                'name' => 'Test Co',
                'created_by' => $user->id,
            ],
        );

        if (! $user->organizations()->where('organizations.id', $org->id)->exists()) {
            $user->organizations()->attach($org->id, [
                'role' => 'admin',
                'invited_by' => null,
            ]);
        }
    }
}
