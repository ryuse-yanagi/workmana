<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run (): void
    {
        foreach (DummySeederData::userNames() as $name) {
            User::query()->firstOrCreate(
                ['email' => strtolower($name).'@example.com'],
                [
                    'name' => $name,
                    'password' => Hash::make('password'),
                ],
            );
        }
    }
}
