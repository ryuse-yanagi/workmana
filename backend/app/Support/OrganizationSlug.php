<?php

namespace App\Support;

use App\Models\Organization;
use Illuminate\Support\Str;

final class OrganizationSlug
{
    public static function uniqueFromName(string $name, ?string $preferred = null): string
    {
        $preferred = $preferred !== null ? trim($preferred) : '';
        $base = $preferred !== ''
            ? Str::lower($preferred)
            : Str::slug($name);

        if ($base === '') {
            $base = 'org';
        }

        if (! preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $base)) {
            $base = 'org';
        }

        $slug = $base;
        $suffix = 2;
        while (Organization::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}
