<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\SharedDocument;

class DefaultDocumentCategories
{
    /** @var list<array{name: string, color_index: int}> */
    public const DEFAULT_ITEMS = [
        ['name' => 'マニュアル', 'color_index' => 0],
        ['name' => '設計書', 'color_index' => 1],
        ['name' => '会議', 'color_index' => 3],
    ];

    /** @var list<string> */
    public const DEFAULT_NAMES = ['マニュアル', '設計書', '会議'];

    /**
     * @return list<array{name: string, color_index: int}>
     */
    public static function itemsForOrganization(Organization $organization): array
    {
        $raw = $organization->default_document_category_names;

        return self::normalizeItems(is_array($raw) ? $raw : null);
    }

    /**
     * @return list<string>
     */
    public static function namesForOrganization(Organization $organization): array
    {
        return DefaultNamedColorItems::names(self::itemsForOrganization($organization));
    }

    /**
     * @param  list<mixed>|null  $raw
     * @return list<array{name: string, color_index: int}>
     */
    public static function normalizeItems(?array $raw): array
    {
        return DefaultNamedColorItems::normalize($raw, self::DEFAULT_ITEMS);
    }

    public static function defaultCategoryForOrganization(Organization $organization): ?string
    {
        $items = self::itemsForOrganization($organization);

        return $items[0]['name'] ?? null;
    }

    public static function resolvedCategory(SharedDocument $document, Organization $organization): ?string
    {
        $payload = self::resolvedCategoryPayload($document, $organization);

        return $payload['name'] ?? null;
    }

    /**
     * @return array{name: string, color_index: int}|null
     */
    public static function resolvedCategoryPayload(SharedDocument $document, Organization $organization): ?array
    {
        $items = self::itemsForOrganization($organization);
        if ($items === []) {
            return null;
        }

        $category = $document->category;
        if (is_string($category) && $category !== '') {
            $item = DefaultNamedColorItems::findItemByName($items, $category);
            if ($item !== null) {
                return $item;
            }
        }

        return $items[0];
    }

    public static function validateCategoryForOrganization(Organization $organization, ?string $category): ?string
    {
        $names = self::namesForOrganization($organization);
        if ($names === []) {
            return null;
        }

        if ($category === null || trim($category) === '') {
            return $names[0];
        }

        $trimmed = trim($category);
        if (! in_array($trimmed, $names, true)) {
            abort(422, 'Invalid document category for this organization.');
        }

        return $trimmed;
    }
}
