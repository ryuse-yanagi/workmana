<?php

namespace Tests\Unit\Support;

use App\Support\Organization\OrganizationSlug;
use Tests\TestCase;

class OrganizationSlugTest extends TestCase
{
    /** 組織コードは指定桁のランダム文字列で、連続発行しても重複しない */
    public function test_generate_returns_unique_codes_from_the_safe_alphabet(): void
    {
        $codes = [];

        for ($i = 0; $i < 200; $i++) {
            $code = OrganizationSlug::generate();
            $this->assertMatchesRegularExpression(OrganizationSlug::PATTERN, $code);
            $this->assertSame(OrganizationSlug::LENGTH, strlen($code));
            $codes[$code] = true;
        }

        $this->assertCount(200, $codes);
    }
}
