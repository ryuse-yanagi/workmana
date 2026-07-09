<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run (): void
    {
        for ($i = 1; $i <= 20; $i++) {
            $name = 'dmy_user_'.sprintf('%02d', $i);
            User::query()->firstOrCreate(
                ['email' => $name.'@example.com'],
                [
                    'name' => $name,
                    'password' => Hash::make('password'),
                ],
            );
        }
    }
}
