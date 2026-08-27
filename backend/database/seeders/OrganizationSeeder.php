<?php

namespace Database\Seeders;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    /** @deprecated Use DummySeederData::ORG_SLUG */
    public const SLUG = DummySeederData::ORG_SLUG;

    public function run (): void
    {
        $admin = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($admin === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        $org = Organization::query()->firstOrCreate(
            ['slug' => DummySeederData::ORG_SLUG],
            [
                'name' => DummySeederData::ORG_NAME,
                'created_by' => $admin->id,
            ],
        );

        if (! $org->wasRecentlyCreated) {
            $org->update(['name' => DummySeederData::ORG_NAME]);
        }

        if (! $admin->organizations()->where('organizations.id', $org->id)->exists()) {
            $admin->organizations()->attach($org->id, [
                'role' => MembershipRole::Admin->value,
            ]);
        }

        $members = User::query()
            ->whereIn('name', DummySeederData::userNames())
            ->where('id', '!=', $admin->id)
            ->orderBy('id')
            ->get();

        foreach ($members as $user) {
            if ($user->organizations()->where('organizations.id', $org->id)->exists()) {
                continue;
            }

            $user->organizations()->attach($org->id, [
                'role' => MembershipRole::Member->value,
            ]);
        }
    }
}
