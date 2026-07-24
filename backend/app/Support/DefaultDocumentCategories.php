<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\SharedDocument;

class DefaultDocumentCategories
{
    /** @var list<array{name: string, color_index: int}> */
    public const DEFAULT_ITEMS = [
        ['name' => 'その他', 'color_index' => 5],
    ];

    /** @var list<array{name: string, color_index: int}> */
    public const DUMMY_ITEMS = [
        ['name' => '仕様書', 'color_index' => 1],
        ['name' => '設計書', 'color_index' => 0],
        ['name' => 'マニュアル', 'color_index' => 2],
        ['name' => '議事録', 'color_index' => 3],
    ];

    /** @var list<string> */
    public const DEFAULT_NAMES = ['その他'];

    /**
     * 開発用シーダーが組織に投入する資料カテゴリ（ダミー4件 + その他）。
     *
     * @return list<array{name: string, color_index: int}>
     */
    public static function seededItems(): array
    {
        return array_merge(self::DUMMY_ITEMS, self::DEFAULT_ITEMS);
    }

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
        $category = $document->category;
        if (! is_string($category) || $category === '') {
            return null;
        }

        $items = self::itemsForOrganization($organization);
        if ($items === []) {
            return null;
        }

        return DefaultNamedColorItems::findItemByName($items, $category);
    }

    public static function validateCategoryForOrganization(Organization $organization, ?string $category): ?string
    {
        if ($category === null || trim($category) === '') {
            return null;
        }

        $names = self::namesForOrganization($organization);
        $trimmed = trim($category);
        if ($names === [] || ! in_array($trimmed, $names, true)) {
            abort(422, 'Invalid document category for this organization.');
        }

        return $trimmed;
    }
}
