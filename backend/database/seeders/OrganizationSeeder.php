<?php

namespace Database\Seeders;

use App\Enums\MembershipRole;
use App\Models\Organization\Organization;
use App\Models\User;
use App\Support\Organization\OrganizationSlug;
use Illuminate\Database\Seeder;
use RuntimeException;

class OrganizationSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->where('name', DummySeederData::ADMIN_NAME)->first();
        if ($admin === null) {
            $this->command?->warn(DummySeederData::ADMIN_NAME.' not found. Run UserSeeder first.');

            return;
        }

        $org = DummySeederData::seededOrganization();

        if ($org === null) {
            $org = Organization::query()->create([
                'name' => DummySeederData::ORG_NAME,
                'slug' => $this->allocateSlug(),
                'created_by' => $admin->id,
            ]);
        } elseif (! preg_match(OrganizationSlug::PATTERN, $org->slug)) {
            $org->update(['slug' => $this->allocateSlug()]);
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

    private function allocateSlug(): string
    {
        for ($attempt = 0; $attempt < OrganizationSlug::ATTEMPTS; $attempt++) {
            $slug = OrganizationSlug::generate();
            if (! Organization::query()->where('slug', $slug)->exists()) {
                return $slug;
            }
        }

        throw new RuntimeException('組織コードを発行できませんでした。');
    }
}
