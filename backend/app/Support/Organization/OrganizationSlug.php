<?php

namespace App\Support\Organization;

final class OrganizationSlug
{
    /** 見間違いやすい文字を除いた 31 種から 16 文字を選び、推測しにくい識別子にする。 */
    public const LENGTH = 16;

    public const ATTEMPTS = 5;

    public const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

    public const PATTERN = '/^[abcdefghjkmnpqrstuvwxyz23456789]{16}$/';

    public static function generate(): string
    {
        $alphabetLength = strlen(self::ALPHABET);
        $slug = '';

        for ($i = 0; $i < self::LENGTH; $i++) {
            $slug .= self::ALPHABET[random_int(0, $alphabetLength - 1)];
        }

        return $slug;
    }
}
