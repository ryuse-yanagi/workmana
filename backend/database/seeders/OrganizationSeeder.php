<?php

namespace Database\Seeders;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    public const SLUG = 'dmy_org';

    public function run (): void
    {
        $admin = User::query()->where('name', 'dmy_user_1')->first();
        if ($admin === null) {
            $this->command?->warn('dmy_user_1 not found. Run UserSeeder first.');

            return;
        }

        $org = Organization::query()->firstOrCreate(
            ['slug' => self::SLUG],
            [
                'name' => 'dmy_org',
                'created_by' => $admin->id,
            ],
        );

        if (! $admin->organizations()->where('organizations.id', $org->id)->exists()) {
            $admin->organizations()->attach($org->id, [
                'role' => MembershipRole::Admin->value,
                'invited_by' => null,
            ]);
        }

        $dummyUsers = User::query()
            ->where('name', 'like', 'dmy_user_%')
            ->where('id', '!=', $admin->id)
            ->orderBy('id')
            ->get();

        foreach ($dummyUsers as $user) {
            if ($user->organizations()->where('organizations.id', $org->id)->exists()) {
                continue;
            }

            $user->organizations()->attach($org->id, [
                'role' => MembershipRole::Member->value,
                'invited_by' => $admin->id,
            ]);
        }
    }
}
