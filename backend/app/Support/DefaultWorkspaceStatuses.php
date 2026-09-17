<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Workspace;

class DefaultWorkspaceStatuses
{
    /**
     * @return list<array{name: string, color_index: int}>
     */
    public static function defaultItems(): array
    {
        /** @var list<array{name: string, color_index: int}> $items */
        $items = SharedJson::load('default-named-color-items.json')['workspaceStatuses'];

        return $items;
    }

    /**
     * @return list<string>
     */
    public static function defaultNames(): array
    {
        return DefaultNamedColorItems::names(self::defaultItems());
    }

    /**
     * @return list<array{name: string, color_index: int}>
     */
    public static function itemsForOrganization(Organization $organization): array
    {
        $raw = $organization->default_workspace_status_names;

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
        return DefaultNamedColorItems::normalize($raw, self::defaultItems(), FieldLengthLimits::WORKSPACE_STATUS_NAME);
    }

    /**
     * @param  list<mixed>|null  $names
     * @return list<string>
     * @deprecated Use normalizeItems() for color-aware settings.
     */
    public static function normalizeNames(?array $names): array
    {
        return DefaultNamedColorItems::names(self::normalizeItems($names));
    }

    public static function defaultStatusForOrganization(Organization $organization): ?string
    {
        $items = self::itemsForOrganization($organization);

        return $items[0]['name'] ?? null;
    }

    public static function resolvedStatus(Workspace $workspace, Organization $organization): ?string
    {
        $payload = self::resolvedStatusPayload($workspace, $organization);

        return $payload['name'] ?? null;
    }

    /**
     * @return array{name: string, color_index: int}|null
     */
    public static function resolvedStatusPayload(Workspace $workspace, Organization $organization): ?array
    {
        $status = $workspace->status;
        if (! is_string($status) || $status === '') {
            return null;
        }

        $items = self::itemsForOrganization($organization);
        if ($items === []) {
            return null;
        }

        return DefaultNamedColorItems::findItemByName($items, $status);
    }

    public static function validateStatusForOrganization(Organization $organization, ?string $status): ?string
    {
        if ($status === null || trim($status) === '') {
            return null;
        }

        $names = self::namesForOrganization($organization);
        $trimmed = trim($status);
        if ($names === [] || ! in_array($trimmed, $names, true)) {
            abort(422, 'Invalid workspace status for this organization.');
        }

        return $trimmed;
    }

    /**
     * 組織のステータス設定変更に合わせ、スペースへ保存済みの status 文字列を更新する。
     * リネームは書き換え、削除された名前のみ null にする。
     *
     * @param  list<array{name: string, color_index: int}>  $oldItems
     * @param  list<array{name: string, color_index: int}>  $newItems
     */
    public static function syncWorkspaceStatusNames(
        Organization $organization,
        array $oldItems,
        array $newItems,
    ): void {
        $diff = DefaultNamedColorItems::diffNameChanges($oldItems, $newItems);
        DefaultNamedColorItems::syncStoredNames(
            Workspace::withTrashed()->where('organization_id', $organization->id),
            'status',
            $diff,
        );
    }
}
