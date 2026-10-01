<?php

namespace App\Support\Document;

use App\Models\Document\Document;
use App\Models\Organization\Organization;
use App\Support\DefaultNamedColorItems;
use App\Support\FieldLengthLimits;
use App\Support\SharedJson;

class DefaultDocumentCategories
{
    /**
     * 組織未設定時のフォールバック（正本: shared/default-named-color-items.json）。
     *
     * @return list<array{name: string, color_index: int}>
     */
    public static function defaultItems(): array
    {
        /** @var list<array{name: string, color_index: int}> $items */
        $items = SharedJson::load('default-named-color-items.json')['documentCategories'];

        return $items;
    }

    /**
     * 開発用ダミーデータ（シーダー専用。共有契約ではない）。
     *
     * @var list<array{name: string, color_index: int}>
     */
    public const DUMMY_ITEMS = [
        ['name' => '仕様書', 'color_index' => 1],
        ['name' => '設計書', 'color_index' => 0],
        ['name' => 'マニュアル', 'color_index' => 2],
        ['name' => '議事録', 'color_index' => 3],
    ];

    /**
     * 開発用シーダーが組織に投入する資料カテゴリ。
     *
     * @return list<array{name: string, color_index: int}>
     */
    public static function seededItems(): array
    {
        return array_values([
            ...self::DUMMY_ITEMS,
            ...self::defaultItems(),
        ]);
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
        return DefaultNamedColorItems::normalize($raw, self::defaultItems(), FieldLengthLimits::DOCUMENT_CATEGORY_NAME);
    }

    /**
     * 組織の資料カテゴリに一致するときだけ名前と色を返す。
     *
     * @return array{name: string, color_index: int}|null
     */
    public static function resolvedCategoryPayload(Document $document, Organization $organization): ?array
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

    /** 空は許可し、組織の資料カテゴリ名に無い値は 422 にする。 */
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

    /**
     * 組織の資料カテゴリ変更に合わせ、保存済み category をリネームし、消えた名前だけ null にする。
     *
     * @param  list<array{name: string, color_index: int}>  $oldItems
     * @param  list<array{name: string, color_index: int}>  $newItems
     */
    public static function syncDocumentCategoryNames(
        Organization $organization,
        array $oldItems,
        array $newItems,
    ): void {
        $diff = DefaultNamedColorItems::diffNameChanges($oldItems, $newItems);
        DefaultNamedColorItems::syncStoredNames(
            Document::withTrashed()->where('organization_id', $organization->id),
            'category',
            $diff,
        );
    }
}
